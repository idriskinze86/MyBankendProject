import { Request, Response } from "express";
import { scryptSync, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, "hex");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!customer) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const passwordValid = verifyPassword(password, customer.passwordHash);

    if (!passwordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured.",
      });
      return;
    }

    const token = jwt.sign(
      {
        customerId: customer.id,
        email: customer.email,
      },
      secret,
      {
        expiresIn: "1h",
      },
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
        },
      },
    });
  } catch (error: any) {
    console.error("Login failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
}
