import { randomUUID } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "@prisma/client";

const ACCESS_TTL = "7d";
const OTP_PROOF_TTL = "10m";

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  oid: string;
  mobile: string;
  roles: UserRole[];
  cid?: string;
  typ: "access";
};

export type OtpProofPayload = JWTPayload & {
  jti: string;
  mobile: string;
  purpose: "setup" | "forgot_pin";
  typ: "otp_proof";
};

function getSecret(): Uint8Array {
  const value = process.env.JWT_SECRET_OP ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error("Missing JWT_SECRET_OP environment variable");
  }
  return new TextEncoder().encode(value);
}

export async function signAccessToken(input: {
  unitId: string;
  officeUnitId: string;
  mobile: string;
  roles: UserRole[];
  clientUnitId?: string | null;
}): Promise<string> {
  return new SignJWT({
    oid: input.officeUnitId,
    mobile: input.mobile,
    roles: input.roles,
    ...(input.clientUnitId ? { cid: input.clientUnitId } : {}),
    typ: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.unitId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "access" || !payload.sub || typeof payload.oid !== "string") {
      return null;
    }
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function signOtpProofToken(input: {
  mobile: string;
  purpose: "setup" | "forgot_pin";
}): Promise<string> {
  const jti = randomUUID();
  return new SignJWT({
    mobile: input.mobile,
    purpose: input.purpose,
    typ: "otp_proof",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(OTP_PROOF_TTL)
    .sign(getSecret());
}

export async function verifyOtpProofToken(
  token: string
): Promise<OtpProofPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      payload.typ !== "otp_proof" ||
      typeof payload.mobile !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return null;
    }
    return payload as OtpProofPayload;
  } catch {
    return null;
  }
}
