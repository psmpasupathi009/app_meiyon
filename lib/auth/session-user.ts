import { cache } from "react";
import { cookies } from "next/headers";
import { withDbRetry } from "@/lib/db/unreachable";
import { verifyAccessToken } from "@/lib/auth/jwt";
import {
  ACCESS_COOKIE,
  findUserByAccessSub,
  toPublicUser,
  type PublicUser,
} from "@/lib/auth/session";

/**
 * Resolve the signed-in portal user from the access cookie.
 * Throws on Mongo unreachable (after retries) — callers must NOT treat that
 * as "logged out" or they will clear cookies.
 */
export const getSessionUser = cache(async (): Promise<PublicUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload?.sub || !payload.oid) return null;

  return withDbRetry(async () => {
    const user = await findUserByAccessSub(payload.sub, payload.oid);
    if (!user || !user.isActive) return null;

    return toPublicUser({
      id: user.id,
      unitId: user.unitId,
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      mobile: user.mobile,
      roles: user.roles,
      name: user.name,
      designation: user.designation,
      email: user.email,
      address: user.address,
      photoKey: user.photoKey,
      clientUnitId: user.clientUnitId,
      isActive: user.isActive,
    });
  });
});
