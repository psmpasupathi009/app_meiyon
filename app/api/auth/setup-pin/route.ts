import { prisma } from "@meiyon/db";
import { setupPinSchema, hashPin, isWeakPin } from "@meiyon/auth";
import { jsonFail, jsonOk, apiHandler } from "@/lib/api/response";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { consumeOtpProof } from "@/lib/auth/otp-proof";
import { issueSession, sessionCookieOptions } from "@/lib/auth/session";

async function resolveUser(mobile: string, officeUnitId?: string) {
  const users = await prisma.user.findMany({ where: { mobile, isActive: true } });
  if (users.length === 1) return users[0];
  if (officeUnitId) return users.find((u) => u.officeUnitId === officeUnitId) ?? null;
  return users[0] ?? null;
}

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const parsed = setupPinSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    console.warn("[setup-pin] VALIDATION", message);
    return jsonFail("VALIDATION", message, 400);
  }

  if (isWeakPin(parsed.data.pin)) {
    console.warn("[setup-pin] WEAK_PIN");
    return jsonFail(
      "WEAK_PIN",
      "Choose a stronger PIN (avoid 123456 and repeats)",
      400
    );
  }

  const proof = await consumeOtpProof(parsed.data.otpProofToken, "setup");
  if (!proof) {
    console.warn("[setup-pin] INVALID_PROOF");
    return jsonFail("INVALID_PROOF", "OTP verification expired. Start again.", 400);
  }

  const officeUnitId = parsed.data.officeUnitId ?? (proof.officeUnitId as string | undefined);
  const user = await resolveUser(proof.mobile, officeUnitId);
  if (!user?.isActive) {
    return jsonFail("NOT_FOUND", "Number not registered. Contact admin.", 404);
  }
  if (user.pinHash) {
    return jsonFail("PIN_EXISTS", "PIN already set", 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { pinHash: await hashPin(parsed.data.pin), failedPinAttempts: 0, pinLockedUntil: null },
  });

  const tokens = await issueSession(updated);
  const response = jsonOk({ user: tokens.user, message: "PIN set successfully" });
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions());
  return response;
});
