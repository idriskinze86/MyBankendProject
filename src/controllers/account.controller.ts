import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { randomInt } from "crypto";
import prisma from "../lib/prisma";

function generateAccountNumber(): string {
  return randomInt(1000000000, 2000000000).toString();
}

export async function createAccount(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const customerId = req.customerId;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      include: {
        kycRecords: true,
        account: true,
      },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
      return;
    }

    const verifiedKyc = customer.kycRecords.some(
      (kyc) => kyc.status === "VERIFIED",
    );

    if (!verifiedKyc) {
      res.status(403).json({
        success: false,
        message: "Customer must complete KYC before creating an account.",
      });
      return;
    }

    if (customer.account) {
      res.status(409).json({
        success: false,
        message: "Customer already has a bank account.",
        data: {
          accountNumber: customer.account.accountNumber,
        },
      });
      return;
    }

    let accountNumber = generateAccountNumber();

    while (
      await prisma.account.findUnique({
        where: { accountNumber },
      })
    ) {
      accountNumber = generateAccountNumber();
    }

    const account = await prisma.$transaction(async (tx) => {
      const newAccount = await tx.account.create({
        data: {
          accountNumber,
          customerId: customer.id,
          balance: 15000,
          status: "ACTIVE",
        },
      });

      await tx.transaction.create({
        data: {
          reference: `INIT-${Date.now()}-${randomInt(1000, 9999)}`,
          accountId: newAccount.id,
          type: "INITIAL_FUNDING",
          amount: 15000,
          status: "SUCCESSFUL",
          description: "Initial account funding",
        },
      });

      return newAccount;
    });

    res.status(201).json({
      success: true,
      message: "Bank account created successfully.",
      data: {
        accountNumber: account.accountNumber,
        balance: account.balance,
        currency: "NGN",
        status: account.status,
      },
    });
  } catch (error: any) {
    console.error("Account creation failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Account creation failed.",
    });
  }
}
