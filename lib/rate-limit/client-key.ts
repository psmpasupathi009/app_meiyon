/**
 * Best-effort client key for rate limits.
 * Prefer platform-set IPs (Vercel / reverse proxy) over raw X-Forwarded-For,
 * which clients can spoof when the origin is reachable without a trusted proxy.
 */
export function clientRateKey(
  request: Request,
  prefix: string,
  mobile?: string
): string {
  const vercel = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = vercel || real || fwd || "unknown";
  return mobile ? `${prefix}:${mobile}:${ip}` : `${prefix}:${ip}`;
}
