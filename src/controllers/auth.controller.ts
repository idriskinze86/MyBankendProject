import { Request, Response } from "express";
import { randomBytes, scryptSync } from "crypto";
import prisma from "../lib/prisma";
import { validateBvn, validateNin } from "../services/nibbs.service";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDate(value: string): string {
  return new Date(value).toISOString().split("T")[0];
}

export async function onboardCustomer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { firstName, lastName, email, phone, password, bvn, nin, dob } =
      req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !password ||
      !bvn ||
      !nin ||
      !dob
    ) {
      res.status(400).json({
        success: false,
        message:
          "firstName, lastName, email, phone, password, bvn, nin and dob are required.",
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
      return;
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existingCustomer) {
      res.status(409).json({
        success: false,
        message: "A customer with this email or phone already exists.",
      });
      return;
    }

    const existingKyc = await prisma.kycRecord.findFirst({
      where: {
        OR: [{ bvn }, { nin }],
      },
    });

    if (existingKyc) {
      res.status(409).json({
        success: false,
        message: "This BVN or NIN is already linked to a customer.",
      });
      return;
    }

    const bvnResult: any = await validateBvn(bvn);
    const ninResult: any = await validateNin(nin);

    const bvnData = bvnResult?.data;
    const ninData = ninResult?.response;

    if (!bvnData || !ninData) {
      res.status(400).json({
        success: false,
        message: "BVN or NIN validation failed.",
      });
      return;
    }

    const requestedFirstName = normalize(firstName);
    const requestedLastName = normalize(lastName);
    const requestedDob = normalizeDate(dob);

    const bvnFirstName = normalize(bvnData.firstName);
    const bvnLastName = normalize(bvnData.lastName);
    const bvnDob = normalizeDate(bvnData.dob);

    const ninFirstName = normalize(ninData.firstName);
    const ninLastName = normalize(ninData.lastName);
    const ninDob = normalizeDate(ninData.dob);

    const identityMatches =
      requestedFirstName === bvnFirstName &&
      requestedLastName === bvnLastName &&
      requestedDob === bvnDob &&
      requestedFirstName === ninFirstName &&
      requestedLastName === ninLastName &&
      requestedDob === ninDob;

    if (!identityMatches) {
      res.status(400).json({
        success: false,
        message:
          "The submitted customer information does not match the verified BVN and NIN records.",
      });
      return;
    }

    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          passwordHash: hashPassword(password),
        },
      });

      await tx.kycRecord.create({
        data: {
          customerId: newCustomer.id,
          bvn,
          nin,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });

      return newCustomer;
    });

    res.status(201).json({
      success: true,
      message: "Customer onboarded successfully.",
      data: {
        customerId: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        kycStatus: "VERIFIED",
      },
    });
  } catch (error: any) {
    console.error("Customer onboarding failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Customer onboarding failed.",
    });
  }
}
