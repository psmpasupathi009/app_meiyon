/**
 * 2factor SMS OTP — official docs:
 * https://documenter.getpostman.com/view/301893/TWDamFGh
 *
 * Send (4-digit OTP + approved template):
 *   GET /API/V1/{api_key}/SMS/{phone}/AUTOGEN3/{otp_template_name}
 *
 * Verify:
 *   GET /API/V1/{api_key}/SMS/VERIFY/{otp_session_id}/{otp}
 *
 * Phone for SMS OTP API must be 10 digits (docs error: Expected: 10).
 * Channel is SMS only — never VOICE / WhatsApp voice endpoints.
 */

type TwoFactorResponse = {
  Status: string;
  Details: string;
  OTP?: string;
};

const DEFAULT_TEMPLATE = "mlf";

function getApiKey(): string {
  const key = process.env.TWO_FACTOR_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing TWO_FACTOR_API_KEY environment variable");
  }
  return key;
}

function getTemplateName(): string {
  return (process.env.TWO_FACTOR_TEMPLATE_NAME || DEFAULT_TEMPLATE).trim();
}

/** SMS OTP API expects a 10-digit Indian mobile number. */
export function toTwoFactorPhone(mobile91: string): string {
  const digits = mobile91.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 10) {
    return digits;
  }
  throw new Error(`Invalid mobile for 2factor SMS OTP: expected 10 digits`);
}

async function callSmsApi(path: string): Promise<TwoFactorResponse> {
  const url = `https://2factor.in/API/V1/${getApiKey()}/SMS/${path}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  let data: TwoFactorResponse;
  try {
    data = JSON.parse(raw) as TwoFactorResponse;
  } catch {
    throw new Error(`2factor returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`);
  }

  return data;
}

/**
 * Send 4-digit SMS OTP via approved OTP template (AUTOGEN3).
 * Returns 2factor session id for VERIFY.
 */
export async function sendOtpSms(
  mobile91: string
): Promise<{ sessionId: string }> {
  const phone = toTwoFactorPhone(mobile91);
  const template = encodeURIComponent(getTemplateName());
  const data = await callSmsApi(`${phone}/AUTOGEN3/${template}`);

  if (data.Status !== "Success" || !data.Details) {
    throw new Error(data.Details || "Failed to send SMS OTP");
  }

  return { sessionId: data.Details };
}

/**
 * Verify OTP against 2factor session id from sendOtpSms.
 * Docs sample sometimes shows Status:"Error" with Details:"OTP Matched" —
 * treat Details === "OTP Matched" as success.
 */
export async function verifyOtpSms(
  sessionId: string,
  otp: string
): Promise<boolean> {
  const data = await callSmsApi(
    `VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`
  );

  const details = (data.Details || "").toLowerCase();
  if (details.includes("otp matched") || details.includes("matched")) {
    return true;
  }

  return data.Status === "Success";
}

/**
 * Transactional (non-OTP) SMS via 2factor's open-template Addon Service.
 * Requires the sender ID to have "Open Template" (dynamic content) enabled
 * on the 2factor account — otherwise the account needs a DLT-approved
 * fixed template instead of arbitrary message text.
 */
export async function sendTransactionalSms(
  mobile91: string,
  message: string
): Promise<{ ok: boolean; details: string }> {
  const phone = toTwoFactorPhone(mobile91);
  const senderId = (process.env.TWO_FACTOR_SENDER_ID || "").trim();
  if (!senderId) throw new Error("Missing TWO_FACTOR_SENDER_ID environment variable");

  const url = `https://2factor.in/API/V1/${getApiKey()}/ADDON_SERVICES/SEND/TSMS`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      To: phone,
      From: senderId,
      TemplateName: "OPEN_TEMPLATE",
      Msg: message,
    }).toString(),
  });

  const raw = await res.text();
  let data: TwoFactorResponse;
  try {
    data = JSON.parse(raw) as TwoFactorResponse;
  } catch {
    return { ok: false, details: `Non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}` };
  }

  return { ok: data.Status === "Success", details: data.Details || data.Status };
}
