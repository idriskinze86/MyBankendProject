import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";

export async function getTransactionHistory(
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

    const account = await prisma.account.findUnique({
      where: {
        customerId,
      },
      select: {
        id: true,
        accountNumber: true,
      },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Bank account not found.",
      });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: account.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully.",
      data: {
        accountNumber: account.accountNumber,
        count: transactions.length,
        transactions,
      },
    });
  } catch (error: any) {
    console.error("Transaction history failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve transaction history.",
    });
  }
}
export async function getTransactionStatus(
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

    const reference = String(req.params.reference);

    if (!reference) {
      res.status(400).json({
        success: false,
        message: "Transaction reference is required.",
      });
      return;
    }

    const account = await prisma.account.findUnique({
      where: {
        customerId,
      },
      select: {
        id: true,
        accountNumber: true,
      },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Bank account not found.",
      });
      return;
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        OR: [
          {
            reference,
          },
          {
            externalReference: reference,
          },
        ],
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Transaction status retrieved successfully.",
      data: {
        reference: transaction.reference,
        externalReference: transaction.externalReference,
        accountNumber: account.accountNumber,
        amount: transaction.amount,
        type: transaction.type,
        transferType: transaction.transferType,
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Transaction status failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve transaction status.",
    });
  }
}
