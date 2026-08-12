import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ACCESS_COOKIE_MAX_AGE_SEC, OP_ACCESS_COOKIE, SA_ACCESS_COOKIE } from "./constants";

const ACCESS_TTL = "7d";

export type SaAccessPayload = JWTPayload & {
  sub: string;
  mobile: string;
  roles: string[];
  typ: "access";
};

export type OpAccessPayload = JWTPayload & {
  sub: string;
  oid: string;
  mobile: string;
  roles: string[];
  cid?: string;
  typ: "access";
};

function secret(kind: "sa" | "op"): Uint8Array {
  const v =
    kind === "sa"
      ? process.env.JWT_SECRET_SA
      : process.env.JWT_SECRET_OP ?? process.env.JWT_SECRET;
  if (!v) throw new Error(`Missing JWT secret for ${kind}`);
  return new TextEncoder().encode(v);
}

export async function signSaToken(input: { unitId: string; mobile: string; roles: string[] }) {
  return new SignJWT({ mobile: input.mobile, roles: input.roles, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.unitId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret("sa"));
}

export async function signOpToken(input: {
  unitId: string;
  officeUnitId: string;
  mobile: string;
  roles: string[];
  clientUnitId?: string | null;
}) {
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
    .sign(secret("op"));
}

export async function verifySaToken(token: string): Promise<SaAccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("sa"));
    if (payload.typ !== "access" || !payload.sub) return null;
    return payload as SaAccessPayload;
  } catch {
    return null;
  }
}

export async function verifyOpToken(token: string): Promise<OpAccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("op"));
    if (payload.typ !== "access" || !payload.sub || typeof payload.oid !== "string") return null;
    return payload as OpAccessPayload;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge = ACCESS_COOKIE_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { SA_ACCESS_COOKIE, OP_ACCESS_COOKIE };
