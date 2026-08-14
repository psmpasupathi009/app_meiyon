export { sendSetupOtp } from "@meiyon/auth";
import { sendSetupOtp as send } from "@meiyon/auth";

export async function trySendSetupOtp(mobile91: string): Promise<{
  inviteSent: boolean;
  bypassed: boolean;
  otp?: string;
}> {
  try {
    return await send(mobile91);
  } catch (error) {
    console.error("setup OTP failed", error);
    return { inviteSent: false, bypassed: false };
  }
}
