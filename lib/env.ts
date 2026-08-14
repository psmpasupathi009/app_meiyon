const PLACEHOLDER_HINTS = ["change-me", "local-dev", "placeholder", "example"];

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isWeakSecret(value: string, min = 24): boolean {
  const v = value.trim();
  if (v.length < min) return true;
  const lower = v.toLowerCase();
  return PLACEHOLDER_HINTS.some((h) => lower.includes(h));
}

function requireHttpsUrl(name: string, value: string | undefined): void {
  const v = (value ?? "").trim();
  if (!v.startsWith("https://") || v.includes("localhost")) {
    throw new Error(
      `Invalid environment: ${name} must be a public https URL in production`
    );
  }
}

export function assertEnv(): void {
  const db = process.env.DATABASE_URL?.trim() ?? "";
  if (!db) throw new Error("Invalid environment: DATABASE_URL is required");

  const jwt = process.env.JWT_SECRET_OP?.trim() ?? "";
  if (jwt.length < 32) {
    throw new Error(
      "Invalid environment: JWT_SECRET_OP must be at least 32 characters"
    );
  }

  if (!isProduction()) return;

  if (isWeakSecret(jwt, 32)) {
    throw new Error(
      "Invalid environment: JWT_SECRET_OP must be a unique production secret (not a local placeholder)"
    );
  }

  const cron = process.env.CRON_SECRET?.trim() ?? "";
  if (isWeakSecret(cron, 24)) {
    throw new Error(
      "Invalid environment: CRON_SECRET must be a long random string in production"
    );
  }

  if (!process.env.TWO_FACTOR_API_KEY?.trim()) {
    throw new Error("Invalid environment: TWO_FACTOR_API_KEY is required in production");
  }

  requireHttpsUrl("NEXT_PUBLIC_PORTAL_URL", process.env.NEXT_PUBLIC_PORTAL_URL);
  requireHttpsUrl("NEXT_PUBLIC_ADMIN_URL", process.env.NEXT_PUBLIC_ADMIN_URL);
  requireHttpsUrl("NEXT_PUBLIC_MARKETING_URL", process.env.NEXT_PUBLIC_MARKETING_URL);

  const rzp = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const rzpPub =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || rzp;
  if (!rzp.startsWith("rzp_live_") || !rzpPub.startsWith("rzp_live_")) {
    throw new Error(
      "Invalid environment: use Razorpay live keys (rzp_live_) in production"
    );
  }
  if (!process.env.RAZORPAY_KEY_SECRET?.trim()) {
    throw new Error("Invalid environment: RAZORPAY_KEY_SECRET is required in production");
  }
  if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    throw new Error(
      "Invalid environment: RAZORPAY_WEBHOOK_SECRET is required in production"
    );
  }

  const cloud =
    process.env.CLOUDINARY_URL?.trim() ||
    (process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim());
  if (!cloud) {
    throw new Error("Invalid environment: Cloudinary credentials are required in production");
  }
}
