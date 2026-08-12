import { apiFetch } from "@/lib/api/client";

type ListEnvelope<T> = {
  data?: T[];
  meta?: { page?: number; pageSize?: number; total?: number };
};

/**
 * Fetch a paginated `{ data, meta }` list. Throws on transport/API failure
 * so AsyncSearchSelect can show an error instead of a false empty.
 */
export async function fetchPagedList<T>(
  path: string,
  {
    query,
    page,
    pageSize,
    extraParams,
  }: {
    query: string;
    page: number;
    pageSize: number;
    extraParams?: Record<string, string>;
  }
): Promise<{ items: T[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...extraParams,
  });
  if (query.trim()) params.set("q", query.trim());

  const sep = path.includes("?") ? "&" : "?";
  const { ok, data } = await apiFetch<ListEnvelope<T>>(
    `${path}${sep}${params.toString()}`
  );

  if (!ok || !data || typeof data !== "object") {
    throw new Error("Failed to load options");
  }

  const items = Array.isArray(data.data) ? data.data : [];
  const total =
    data.meta && typeof data.meta.total === "number"
      ? data.meta.total
      : items.length;

  return { items, total };
}
