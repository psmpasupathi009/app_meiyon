export function getRazorpayKeyId(): string {
  const key = process.env.RAZORPAY_KEY_ID?.trim();
  if (!key) throw new Error("Missing RAZORPAY_KEY_ID");
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
