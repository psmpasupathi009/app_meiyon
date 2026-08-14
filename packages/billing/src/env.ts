export function getRazorpayKeyId(): string {
  const key = process.env.RAZORPAY_KEY_ID?.trim();
  if (!key) throw new Error("Missing RAZORPAY_KEY_ID");
  if (process.env.NODE_ENV === "production" && !key.startsWith("rzp_live_")) {
    throw new Error("RAZORPAY_KEY_ID must be a live key (rzp_live_) in production");
  }
  return key;
}

export function getRazorpayKeySecret(): string {
  const key = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key) throw new Error("Missing RAZORPAY_KEY_SECRET");
  return key;
}

export function getRazorpayWebhookSecret(): string | undefined {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined;
}

export function getPublicRazorpayKeyId(): string {
  return (
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    process.env.RAZORPAY_KEY_ID?.trim() ||
    ""
  );
}
