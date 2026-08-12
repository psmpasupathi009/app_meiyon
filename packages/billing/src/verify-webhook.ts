import crypto from "crypto";
import { getRazorpayWebhookSecret } from "./env";

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  const secret = getRazorpayWebhookSecret();
  if (!secret) {
    console.warn("[billing] RAZORPAY_WEBHOOK_SECRET not set — skipping verify in dev");
    return process.env.NODE_ENV !== "production";
  }
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return expected === input.signature;
}
