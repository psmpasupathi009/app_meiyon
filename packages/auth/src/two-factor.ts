type TwoFactorResponse = { Status: string; Details: string };

export const DEV_SESSION_ID = "dev-bypass";
export const DEV_OTP = "0000";

/**
 * Local/dev: never send SMS unless OTP_LIVE=1.
 * Production always uses 2Factor.
 */
export function isDevOtpBypass(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.OTP_LIVE === "1") return false;
  return true;
}

function getApiKey(): string {
  const key = process.env.TWO_FACTOR_API_KEY?.trim();
  if (!key) throw new Error("Missing TWO_FACTOR_API_KEY");
  return key;
}

function getTemplateName(): string {
  return (process.env.TWO_FACTOR_TEMPLATE_NAME || "meiyon").trim();
}

export function toTwoFactorPhone(mobile91: string): string {
  const digits = mobile91.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 10) return digits;
  throw new Error("Invalid mobile for 2factor");
}

async function callSmsApi(path: string): Promise<TwoFactorResponse> {
  const url = `https://2factor.in/API/V1/${getApiKey()}/SMS/${path}`;
  const res = await fetch(url, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
  const raw = await res.text();
  try {
    return JSON.parse(raw) as TwoFactorResponse;
  } catch {
    throw new Error(`2factor non-JSON (HTTP ${res.status})`);
  }
}

export async function sendOtpSms(
  mobile91: string
): Promise<{ sessionId: string; bypassed: boolean }> {
  if (isDevOtpBypass()) {
    console.log(`[otp-dev] no SMS → ${mobile91}; local OTP ${DEV_OTP}`);
    return { sessionId: DEV_SESSION_ID, bypassed: true };
  }

  const phone = toTwoFactorPhone(mobile91);
  const template = encodeURIComponent(getTemplateName());
  const data = await callSmsApi(`${phone}/AUTOGEN3/${template}`);
  if (data.Status !== "Success" || !data.Details) {
    throw new Error(data.Details || "Failed to send SMS OTP");
  }
  return { sessionId: data.Details, bypassed: false };
}

export async function verifyOtpSms(sessionId: string, otp: string): Promise<boolean> {
  if (isDevOtpBypass() && sessionId === DEV_SESSION_ID) {
    return otp === DEV_OTP;
  }

  const data = await callSmsApi(`VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`);
  const details = (data.Details || "").toLowerCase();
  if (details.includes("otp matched") || details.includes("matched")) return true;
  return data.Status === "Success";
}
