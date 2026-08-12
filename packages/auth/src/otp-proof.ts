import { randomUUID } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const OTP_PROOF_TTL = "10m";

export type OtpProofPayload = JWTPayload & {
  jti: string;
  mobile: string;
  purpose: "setup" | "forgot_pin";
  officeUnitId?: string;
  typ: "otp_proof";
};

function otpSecret(): Uint8Array {
  const v = process.env.JWT_SECRET_OP ?? process.env.JWT_SECRET_SA ?? process.env.JWT_SECRET;
  if (!v) throw new Error("Missing JWT secret for OTP proof");
  return new TextEncoder().encode(v);
}

export async function signOtpProofToken(input: {
  mobile: string;
  purpose: "setup" | "forgot_pin";
  officeUnitId?: string;
}): Promise<string> {
  const jti = randomUUID();
  return new SignJWT({
    mobile: input.mobile,
    purpose: input.purpose,
    ...(input.officeUnitId ? { officeUnitId: input.officeUnitId } : {}),
    typ: "otp_proof",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(OTP_PROOF_TTL)
    .sign(otpSecret());
}

export async function verifyOtpProofToken(token: string): Promise<OtpProofPayload | null> {
  try {
    const { payload } = await jwtVerify(token, otpSecret());
    if (payload.typ !== "otp_proof" || typeof payload.mobile !== "string" || typeof payload.jti !== "string")
      return null;
    return payload as OtpProofPayload;
  } catch {
    return null;
  }
}

export async function consumeOtpProof(
  prisma: { consumedOtpProof: { findUnique: (args: unknown) => Promise<unknown>; create: (args: unknown) => Promise<unknown> } },
  token: string,
  expectedPurpose: "setup" | "forgot_pin"
): Promise<OtpProofPayload | null> {
  const proof = await verifyOtpProofToken(token);
  if (!proof || proof.purpose !== expectedPurpose || !proof.jti) return null;

  const existing = await prisma.consumedOtpProof.findUnique({ where: { jti: proof.jti } });
  if (existing) return null;

  const expMs = typeof proof.exp === "number" ? proof.exp * 1000 : Date.now() + 10 * 60 * 1000;
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
    return null;
  }
  return proof;
}
