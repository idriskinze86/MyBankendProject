import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";
import { nibbsRequest } from "../services/nibbs.service";

export async function nameEnquiry(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const accountNumber = String(req.params.accountNumber);

    if (!accountNumber) {
      res.status(400).json({
        success: false,
        message: "Account number is required.",
      });
      return;
    }

    const localAccount = await prisma.account.findUnique({
      where: {
        accountNumber,
      },
    });

    if (localAccount) {
      const customer = await prisma.customer.findUnique({
        where: {
          id: localAccount.customerId,
        },
        select: {
          firstName: true,
          lastName: true,
        },
      });

      if (!customer) {
        res.status(404).json({
          success: false,
          message: "Account owner not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Account name enquiry successful.",
        data: {
          accountNumber: localAccount.accountNumber,
          accountName: `${customer.firstName} ${customer.lastName}`,
          bankCode: "909",
          bankName: "STR Bank Prime",
          source: "LOCAL",
        },
      });

      return;
    }

    const result = await nibbsRequest(
      `/api/account/name-enquiry/${accountNumber}`,
      "GET",
    );

    res.status(200).json({
      success: true,
      message: "Account name enquiry successful.",
      data: {
        accountNumber,
        source: "NIBBS",
        result,
      },
    });
  } catch (error: any) {
    console.error("Name enquiry failed:", error.message);

    res.status(404).json({
      success: false,
      message: "Unable to verify account number.",
    });
  }
}
