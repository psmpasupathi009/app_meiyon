import { jsonFail } from "@/lib/api/response";

export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return jsonFail("UNAUTHORIZED", "CRON_SECRET is not configured", 401);
  }
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!header || header !== secret) {
    return jsonFail("UNAUTHORIZED", "Unauthorized", 401);
  }
  return null;
}
