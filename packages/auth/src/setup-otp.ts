import { prisma } from "@meiyon/db";

import { DEV_OTP, isDevOtpBypass, sendOtpSms } from "./two-factor";

const OTP_TTL_MS = 10 * 60 * 1000;

/** Create a setup OTP session (office admin, staff, or client invite). */
export async function sendSetupOtp(mobile91: string): Promise<{
  inviteSent: boolean;
  bypassed: boolean;
  otp?: string;
}> {
  const { sessionId, bypassed } = await sendOtpSms(mobile91);
  await prisma.otpSession.deleteMany({
    where: { mobile: mobile91, purpose: "setup" },
  });
  await prisma.otpSession.create({
    data: {
      mobile: mobile91,
      sessionId,
      purpose: "setup",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  const localBypass = bypassed || isDevOtpBypass();
  return {
    inviteSent: true,
    bypassed: localBypass,
    ...(localBypass ? { otp: DEV_OTP } : {}),
  };
}
