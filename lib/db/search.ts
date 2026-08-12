/**
 * Prisma string contains that ignores case (Mongo + Postgres via QueryMode).
 */
export function containsInsensitive(q: string) {
  return { contains: q, mode: "insensitive" as const };
}
