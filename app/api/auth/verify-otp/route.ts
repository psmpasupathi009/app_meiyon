import { prisma } from "@meiyon/db";
import { verifyOtpSchema, verifyOtpSms, signOtpProofToken, normalizeMobile } from "@meiyon/auth";
import { jsonFail, jsonOk, apiHandler } from "@/lib/api/response";

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!mobile) return jsonFail("VALIDATION", "Invalid mobile number", 400);

  const officeUnitId = typeof body.officeUnitId === "string" ? body.officeUnitId : undefined;

  const session = await prisma.otpSession.findFirst({
    where: {
      mobile,
      purpose: parsed.data.purpose,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return jsonFail("OTP_EXPIRED", "OTP expired. Request a new code.", 400);
  }

  const matched = await verifyOtpSms(session.sessionId, parsed.data.otp);
  if (!matched) {
    return jsonFail("INVALID_OTP", "Invalid OTP", 401);
  }

  await prisma.otpSession.update({ where: { id: session.id }, data: { verified: true } });

  const otpProofToken = await signOtpProofToken({
    mobile,
    purpose: parsed.data.purpose,
    officeUnitId,
  });

  return jsonOk({ otpProofToken });
});
