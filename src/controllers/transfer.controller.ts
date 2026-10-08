import { randomInt } from "crypto";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";
import { transferThroughNibbs } from "../services/nibbs.service";

export async function intraBankTransfer(
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

    const { destinationAccount, amount, description } = req.body;

    if (!destinationAccount || amount === undefined) {
      res.status(400).json({
        success: false,
        message: "destinationAccount and amount are required.",
      });
      return;
    }

    const transferAmount = Number(amount);

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be a valid number greater than zero.",
      });
      return;
    }

    const sender = await prisma.account.findUnique({
      where: {
        customerId,
      },
    });

    if (!sender) {
      res.status(404).json({
        success: false,
        message: "Sender account not found.",
      });
      return;
    }

    if (sender.status !== "ACTIVE") {
      res.status(400).json({
        success: false,
        message: "Sender account is not active.",
      });
      return;
    }

    if (sender.accountNumber === destinationAccount) {
      res.status(400).json({
        success: false,
        message: "You cannot transfer money to your own account.",
      });
      return;
    }

    const recipient = await prisma.account.findUnique({
      where: {
        accountNumber: String(destinationAccount),
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!recipient) {
      res.status(404).json({
        success: false,
        message: "Destination account not found.",
      });
      return;
    }

    if (recipient.status !== "ACTIVE") {
      res.status(400).json({
        success: false,
        message: "Destination account is not active.",
      });
      return;
    }

    if (Number(sender.balance) < transferAmount) {
      res.status(400).json({
        success: false,
        message: "Insufficient account balance.",
      });
      return;
    }

    const transferReference = `TRF-${Date.now()}-${randomInt(1000, 9999)}`;

    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: {
          id: sender.id,
        },
        data: {
          balance: {
            decrement: transferAmount,
          },
        },
      });

      await tx.account.update({
        where: {
          id: recipient.id,
        },
        data: {
          balance: {
            increment: transferAmount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          reference: `${transferReference}-OUT`,
          accountId: sender.id,
          type: "TRANSFER_OUT",
          transferType: "INTRA_BANK",
          amount: transferAmount,
          status: "SUCCESSFUL",
          description: description || "Intra-bank transfer",
          destinationBank: "909",
          destinationAccount: recipient.accountNumber,
          destinationName: `${recipient.customer.firstName} ${recipient.customer.lastName}`,
          externalReference: transferReference,
        },
      });

      await tx.transaction.create({
        data: {
          reference: `${transferReference}-IN`,
          accountId: recipient.id,
          type: "TRANSFER_IN",
          transferType: "INTRA_BANK",
          amount: transferAmount,
          status: "SUCCESSFUL",
          description: description || "Intra-bank transfer",
          destinationBank: "909",
          destinationAccount: sender.accountNumber,
          externalReference: transferReference,
        },
      });
    });
    const updatedSender = await prisma.account.findUnique({
      where: {
        id: sender.id,
      },
      select: {
        accountNumber: true,
        balance: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Intra-bank transfer successful.",
      data: {
        reference: transferReference,
        transferType: "INTRA_BANK",
        amount: transferAmount,
        destinationAccount: recipient.accountNumber,
        destinationName: `${recipient.customer.firstName} ${recipient.customer.lastName}`,
        accountNumber: updatedSender?.accountNumber,
        balance: updatedSender?.balance,
        currency: "NGN",
        status: "SUCCESSFUL",
      },
    });
  } catch (error: any) {
    console.error("Intra-bank transfer failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Intra-bank transfer failed.",
    });
  }
}
export async function interBankTransfer(
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

    const { destinationAccount, amount } = req.body;

    if (!destinationAccount || amount === undefined) {
      res.status(400).json({
        success: false,
        message: "destinationAccount and amount are required.",
      });
      return;
    }

    const transferAmount = Number(amount);

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be a valid number greater than zero.",
      });
      return;
    }

    const sender = await prisma.account.findUnique({
      where: {
        customerId,
      },
    });

    if (!sender) {
      res.status(404).json({
        success: false,
        message: "Sender account not found.",
      });
      return;
    }

    if (sender.status !== "ACTIVE") {
      res.status(400).json({
        success: false,
        message: "Sender account is not active.",
      });
      return;
    }

    if (Number(sender.balance) < transferAmount) {
      res.status(400).json({
        success: false,
        message: "Insufficient account balance.",
      });
      return;
    }

    const nibbsResult = await transferThroughNibbs(
      sender.accountNumber,
      String(destinationAccount),
      transferAmount,
    );

    const reference = `NIBBS-${Date.now()}-${randomInt(1000, 9999)}`;

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: {
          id: sender.id,
        },
        data: {
          balance: {
            decrement: transferAmount,
          },
        },
      });

      return tx.transaction.create({
        data: {
          reference,
          accountId: sender.id,
          type: "TRANSFER_OUT",
          transferType: "INTER_BANK",
          amount: transferAmount,
          status: "SUCCESSFUL",
          description: "Inter-bank transfer",
          destinationBank: "NIBBS",
          destinationAccount: String(destinationAccount),
          externalReference: nibbsResult?.reference || null,
        },
      });
    });

    const updatedSender = await prisma.account.findUnique({
      where: {
        id: sender.id,
      },
      select: {
        accountNumber: true,
        balance: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Inter-bank transfer successful.",
      data: {
        reference: transaction.reference,
        externalReference: transaction.externalReference,
        transferType: "INTER_BANK",
        amount: transaction.amount,
        destinationAccount: destinationAccount,
        accountNumber: updatedSender?.accountNumber,
        balance: updatedSender?.balance,
        currency: "NGN",
        status: transaction.status,
        nibbsResponse: nibbsResult,
      },
    });
  } catch (error: any) {
    console.error("Inter-bank transfer failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Inter-bank transfer failed.",
      error: error.message,
    });
  }
}
