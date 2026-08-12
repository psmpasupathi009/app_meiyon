import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@meiyon/db";
import {
  signAccessToken,
  verifyAccessToken,
  type AccessTokenPayload,
} from "@/lib/auth/jwt";
import { getEffectivePermissionsForRoles } from "@/lib/rbac";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_SEC,
  LEGACY_REFRESH_COOKIE,
} from "@/lib/auth/cookie-names";
import { userPhotoUrl } from "@/lib/auth/user-photo";

export { ACCESS_COOKIE } from "@/lib/auth/cookie-names";

export type AuthUser = {
  id: string;
  unitId: string;
  officeId: string;
  officeUnitId: string;
  mobile: string;
  roles: UserRole[];
  name: string | null;
  designation?: string | null;
  email?: string | null;
  address?: string | null;
  photoKey?: string | null;
  clientUnitId?: string | null;
  isActive: boolean;
};

export type PublicUser = {
  unitId: string;
  officeUnitId: string;
  mobile: string;
  roles: UserRole[];
  name?: string;
  designation?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  clientUnitId?: string;
  permissions: string[];
};

export async function toPublicUser(user: AuthUser): Promise<PublicUser> {
  const permissions = user.isActive
    ? await getEffectivePermissionsForRoles(user.roles, user.officeId)
    : [];
  return {
    unitId: user.unitId,
    officeUnitId: user.officeUnitId,
    mobile: user.mobile,
    roles: user.roles,
    name: user.name ?? undefined,
    designation: user.designation ?? undefined,
    email: user.email ?? undefined,
    address: user.address ?? undefined,
    photoUrl: userPhotoUrl(user.unitId, Boolean(user.photoKey)),
    clientUnitId: user.clientUnitId ?? undefined,
    permissions,
  };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function issueSession(user: User): Promise<{
  accessToken: string;
  user: PublicUser;
}> {
  const accessToken = await signAccessToken({
    unitId: user.unitId,
    officeUnitId: user.officeUnitId,
    mobile: user.mobile,
    roles: user.roles,
    clientUnitId: user.clientUnitId,
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  return {
    accessToken,
    user: await toPublicUser(updated as unknown as AuthUser),
  };
}

export function sessionCookieOptions() {
  return cookieOptions(ACCESS_COOKIE_MAX_AGE_SEC);
}

export async function issueAuthTokens(user: AuthUser): Promise<{
  accessToken: string;
  user: PublicUser;
}> {
  return issueSession(user as User);
}

export function attachAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string }
): NextResponse {
  response.cookies.set(
    ACCESS_COOKIE,
    tokens.accessToken,
    sessionCookieOptions()
  );
  response.cookies.set(LEGACY_REFRESH_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(LEGACY_REFRESH_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function getAccessPayloadFromRequest(
  request: Request
): Promise<AccessTokenPayload | null> {
  const bearer = getBearerToken(request);
  if (bearer) return verifyAccessToken(bearer);

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!cookieToken) return null;
  return verifyAccessToken(cookieToken);
}

function isLegacyObjectIdSub(sub: string): boolean {
  return /^[a-f\d]{24}$/i.test(sub);
}

export async function findUserByAccessSub(sub: string, officeUnitId?: string) {
  const byUnit = await prisma.user.findFirst({
    where: {
      unitId: sub,
      ...(officeUnitId ? { officeUnitId } : {}),
    },
  });
  if (byUnit) return byUnit;
  if (!isLegacyObjectIdSub(sub)) return null;
  return prisma.user.findUnique({ where: { id: sub } });
}

export async function getCurrentUser(request: Request): Promise<User | null> {
  const payload = await getAccessPayloadFromRequest(request);
  if (!payload?.sub || !payload.oid) return null;

  const user = await findUserByAccessSub(payload.sub, payload.oid);
  if (!user || !user.isActive) return null;
  if (user.officeUnitId !== payload.oid) return null;
  return user;
}

export async function getSessionUserRecord(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload?.sub || !payload.oid) return null;

  const user = await prisma.user.findFirst({
    where: {
      unitId: payload.sub,
      officeUnitId: payload.oid,
      isActive: true,
    },
  });
  return user;
}

export function applyCorsHeaders(
  request: Request,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3002")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (origin && allowed.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }

  return response;
}

export function corsPreflight(request: Request): NextResponse | null {
  if (request.method !== "OPTIONS") return null;
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(request, response);
}
