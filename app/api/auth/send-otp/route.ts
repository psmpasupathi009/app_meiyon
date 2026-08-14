import { prisma } from "@meiyon/db";
import {
  sendOtpSchema,
  sendOtpSms,
  normalizeMobile,
  isDevOtpBypass,
  DEV_OTP,
} from "@meiyon/auth";
import { jsonFail, jsonOk, apiHandler } from "@/lib/api/response";

const OTP_TTL_MS = 10 * 60 * 1000;

async function resolveUser(mobile: string, officeUnitId?: string) {
  const users = await prisma.user.findMany({ where: { mobile, isActive: true } });
  if (users.length === 0) return null;
  if (users.length === 1) return users[0];
  if (!officeUnitId) return null;
  return users.find((u) => u.officeUnitId === officeUnitId) ?? null;
}

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!mobile) return jsonFail("VALIDATION", "Invalid mobile number", 400);

  const officeUnitId = typeof body.officeUnitId === "string" ? body.officeUnitId : undefined;
  const user = await resolveUser(mobile, officeUnitId);

  if (parsed.data.purpose === "setup") {
    if (!user || user.pinHash) {
      return jsonFail("FORBIDDEN", "OTP setup is not available for this number", 400);
    }
  } else {
    if (!user?.pinHash) {
      return jsonFail("FORBIDDEN", "Unable to reset PIN for this number", 400);
    }
  }

  try {
    const { sessionId, bypassed } = await sendOtpSms(mobile);
    await prisma.otpSession.deleteMany({ where: { mobile, purpose: parsed.data.purpose } });
    await prisma.otpSession.create({
      data: {
        mobile,
        sessionId,
        purpose: parsed.data.purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    return jsonOk({
      message: bypassed || isDevOtpBypass() ? "OTP skipped locally (no SMS)" : "OTP sent",
      bypassed: bypassed || isDevOtpBypass(),
      ...(bypassed || isDevOtpBypass() ? { otp: DEV_OTP } : {}),
      expiresInSec: OTP_TTL_MS / 1000,
    });
  } catch (err) {
    return jsonFail("OTP_SEND_FAILED", err instanceof Error ? err.message : "Failed to send OTP", 502);
  }
});
