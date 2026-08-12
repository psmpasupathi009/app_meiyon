import { prisma } from "@meiyon/db";
import type { OtpProofPayload } from "@/lib/auth/jwt";
import { verifyOtpProofToken } from "@/lib/auth/jwt";

/**
 * Verify OTP proof JWT and consume jti once.
 * Returns null if invalid, expired, or already used.
 */
export async function consumeOtpProof(
  token: string,
  expectedPurpose: "setup" | "forgot_pin"
): Promise<OtpProofPayload | null> {
  const proof = await verifyOtpProofToken(token);
  if (!proof || proof.purpose !== expectedPurpose || !proof.jti) {
    return null;
  }

  const existing = await prisma.consumedOtpProof.findUnique({
    where: { jti: proof.jti },
  });
  if (existing) return null;

  const expMs =
    typeof proof.exp === "number"
      ? proof.exp * 1000
      : Date.now() + 10 * 60 * 1000;

  try {
    await prisma.consumedOtpProof.create({
      data: {
        jti: proof.jti,
        mobile: proof.mobile,
        purpose: proof.purpose,
        expiresAt: new Date(expMs),
      },
    });
  } catch {
    // Unique race — already consumed
    return null;
  }

  return proof;
}
