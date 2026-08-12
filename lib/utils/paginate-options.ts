/** Filter + page an in-memory options list (courts / locations meta). */
export function paginateNamedOptions<T extends { code: string; name: string }>(
  options: T[],
  {
    q = "",
    page = 1,
    pageSize = 10,
  }: { q?: string; page?: number; pageSize?: number }
): { options: T[]; total: number; page: number; pageSize: number } {
  const query = q.trim().toLowerCase();
  const filtered = query
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(query) ||
          o.code.toLowerCase().includes(query)
      )
    : options;
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const start = (safePage - 1) * safeSize;
  return {
    options: filtered.slice(start, start + safeSize),
    total: filtered.length,
    page: safePage,
    pageSize: safeSize,
  };
}
