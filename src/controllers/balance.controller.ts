import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";

export async function getBalance(
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
        accountNumber: true,
        balance: true,
        status: true,
      },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Bank account not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Account balance retrieved successfully.",
      data: {
        accountNumber: account.accountNumber,
        balance: account.balance,
        currency: "NGN",
        status: account.status,
      },
    });
  } catch (error: any) {
    console.error("Balance retrieval failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve account balance.",
    });
  }
}
