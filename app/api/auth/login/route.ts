import { prisma } from "@meiyon/db";
import { jsonFail, jsonOk } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { normalizeMobile } from "@/lib/auth/mobile";
import { loginSchema } from "@meiyon/auth";
import {
  isPinLocked,
  PIN_LOCK_MINUTES,
  PIN_MAX_ATTEMPTS,
  verifyPin,
} from "@/lib/auth/pin";
import { issueSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonFail("VALIDATION", "Invalid login details", 400);

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!mobile) return jsonFail("VALIDATION", "Invalid mobile number", 400);

  const users = await prisma.user.findMany({
    where: { mobile, isActive: true },
  });

  let user = users.length === 1 ? users[0] : null;
  if (users.length > 1) {
    if (!parsed.data.officeUnitId) {
      return jsonFail("OFFICE_REQUIRED", "Select an office to continue", 400);
    }
    user = users.find((u) => u.officeUnitId === parsed.data.officeUnitId) ?? null;
  }

  if (!user?.pinHash) {
    return jsonFail("INVALID_CREDENTIALS", "Invalid mobile or PIN", 401);
  }

  if (isPinLocked(user.pinLockedUntil)) {
    return jsonFail(
      "PIN_LOCKED",
      `PIN locked. Try again in ${PIN_LOCK_MINUTES} minutes or use Forgot PIN.`,
      423
    );
  }

  const ok = await verifyPin(parsed.data.pin, user.pinHash);
  if (!ok) {
    const lockUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
    const locked = await prisma.user.updateMany({
      where: {
        id: user.id,
        failedPinAttempts: { gte: PIN_MAX_ATTEMPTS - 1 },
        OR: [{ pinLockedUntil: null }, { pinLockedUntil: { lte: new Date() } }],
      },
      data: { failedPinAttempts: 0, pinLockedUntil: lockUntil },
    });
    if (locked.count === 0) {
      await prisma.user.updateMany({
        where: { id: user.id, failedPinAttempts: { lt: PIN_MAX_ATTEMPTS - 1 } },
        data: { failedPinAttempts: { increment: 1 } },
      });
    }
    return jsonFail("INVALID_CREDENTIALS", "Invalid mobile or PIN", 401);
  }

  const office = await prisma.office.findUnique({ where: { id: user.officeId } });
  if (!office || office.status === "suspended" || office.status === "cancelled") {
    return jsonFail("OFFICE_SUSPENDED", "Office access is suspended", 403);
  }
  if (office.status !== "active") {
    return jsonFail("OFFICE_SUSPENDED", "Office access is not active", 403);
  }

  const sub = await prisma.subscription.findFirst({ where: { officeId: user.officeId } });
  if (
    sub?.status === "suspended" ||
    sub?.status === "expired" ||
    sub?.status === "cancelled"
  ) {
    return jsonFail("SUBSCRIPTION_INACTIVE", "Subscription inactive. Contact admin.", 403);
  }

  const tokens = await issueSession(user);
  const response = jsonOk({ user: tokens.user, message: "Login successful" });
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions());
  return response;
}
