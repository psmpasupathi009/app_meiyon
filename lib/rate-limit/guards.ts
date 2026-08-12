import { jsonFail } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";

/** Shared rate gate for CSV import endpoints (per user). */
export async function assertImportRateLimit(
  request: Request,
  userUnitId: string
): Promise<Response | null> {
  const limited = await rateLimit(
    clientRateKey(request, "import", userUnitId),
    10,
    15 * 60 * 1000
  );
  if (!limited.allowed) {
    return jsonFail(
      "RATE_LIMITED",
      "Too many imports. Try again in a few minutes.",
      429
    );
  }
  return null;
}
