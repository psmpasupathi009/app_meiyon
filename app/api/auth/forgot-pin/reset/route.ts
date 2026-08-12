import { prisma } from "@meiyon/db";
import { forgotPinResetSchema, hashPin, isWeakPin } from "@meiyon/auth";
import { jsonFail, jsonOk } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { consumeOtpProof } from "@/lib/auth/otp-proof";
import { issueSession, sessionCookieOptions } from "@/lib/auth/session";

async function resolveUser(mobile: string, officeUnitId?: string) {
  const users = await prisma.user.findMany({ where: { mobile, isActive: true } });
  if (users.length === 1) return users[0];
  if (officeUnitId) return users.find((u) => u.officeUnitId === officeUnitId) ?? null;
  return users[0] ?? null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = forgotPinResetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  if (isWeakPin(parsed.data.pin)) {
    return jsonFail("WEAK_PIN", "Choose a stronger 6-digit PIN", 400);
  }

  const proof = await consumeOtpProof(parsed.data.otpProofToken, "forgot_pin");
  if (!proof) {
    return jsonFail("INVALID_PROOF", "OTP verification expired. Start again.", 400);
  }

  const officeUnitId = parsed.data.officeUnitId ?? (proof.officeUnitId as string | undefined);
  const user = await resolveUser(proof.mobile, officeUnitId);
  if (!user?.isActive || !user.pinHash) {
    return jsonFail("NOT_FOUND", "User not found", 404);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { pinHash: await hashPin(parsed.data.pin), failedPinAttempts: 0, pinLockedUntil: null },
  });

  const tokens = await issueSession(updated);
  const response = jsonOk({ user: tokens.user, message: "PIN reset successfully" });
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions());
  return response;
}
