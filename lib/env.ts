import { z } from "zod";

const PLACEHOLDER_SECRETS = new Set([
  "change-me-to-a-long-random-string",
  "change-me-cron-secret-long-random",
]);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

let validated = false;

/** Fail fast on boot when required secrets are missing or weak (production). */
export function assertEnv(): void {
  if (validated) return;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }

  if (process.env.NODE_ENV === "production") {
    const jwt = process.env.JWT_SECRET ?? "";
    if (PLACEHOLDER_SECRETS.has(jwt)) {
      throw new Error(
        "Invalid environment: JWT_SECRET must not use the example placeholder in production"
      );
    }
    const cron = process.env.CRON_SECRET?.trim() ?? "";
    if (cron.length < 24 || PLACEHOLDER_SECRETS.has(cron)) {
      throw new Error(
        "Invalid environment: CRON_SECRET must be a long random string in production"
      );
    }
  }

  validated = true;
}
