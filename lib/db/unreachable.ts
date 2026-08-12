// Prefer specific connection failures — avoid bare "timeout" (e.g. OTP messages).
const UNREACHABLE_RE =
  /server selection|serverselection|no available servers|econnrefused|econnreset|enotfound|etimedout|(?:connection|socket|server|operation|network)\s+timed?\s*out|timed\s+out|connect(?:ion)? (?:refused|reset|failed|closed)|i\/o error|noprimary|no primary|replicasetnoprimary|replica set|mongodb.*(connect|network)|engine is not yet connected|prisma.?client.?initialization|can't reach database|could not connect|tlsv1 alert internal error|fatal alert:\s*internalerror|internalerror/i;

function errorText(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) {
    const meta =
      typeof error === "object" &&
      error !== null &&
      "meta" in error &&
      typeof (error as { meta?: unknown }).meta === "object" &&
      (error as { meta?: { message?: unknown } }).meta?.message != null
        ? String((error as { meta: { message: unknown } }).meta.message)
        : "";
    return `${error.name} ${error.message} ${meta}`;
  }
  return String(error);
}

/** True when Mongo/Atlas is unreachable or the engine is not ready yet. */
export function isDbUnreachableError(error: unknown): boolean {
  return UNREACHABLE_RE.test(errorText(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry transient Atlas / cold-start connection failures.
 * Use only for idempotent or read-mostly work — not non-idempotent writes.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isDbUnreachableError(error) || i === attempts - 1) throw error;
      await sleep(120 * 2 ** i);
    }
  }
  throw last;
}
