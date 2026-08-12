"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

export type InfinitePageResult<T> = {
  items: T[];
  total: number;
};

export type FetchPageFn<T> = (args: {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}) => Promise<InfinitePageResult<T>>;

type Options = {
  pageSize?: number;
  debounceMs?: number;
  enabled?: boolean;
};

/**
 * Debounced search + page-based infinite append for combobox lists.
 * Ignores stale responses when the query changes.
 */
export function useInfiniteOptions<T>(
  fetchPage: FetchPageFn<T>,
  { pageSize = 10, debounceMs = 300, enabled = true }: Options = {}
) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** False until the first enabled fetch settles — avoids empty flash on open. */
  const [hasFetched, setHasFetched] = useState(false);

  const requestIdRef = useRef(0);
  const stateRef = useRef({
    enabled,
    loading,
    loadingMore,
    itemsLength: 0,
    total: 0,
    page: 1,
    debouncedQuery,
    pageSize,
  });

  useEffect(() => {
    stateRef.current = {
      enabled,
      loading,
      loadingMore,
      itemsLength: items.length,
      total,
      page,
      debouncedQuery,
      pageSize,
    };
  }, [
    enabled,
    loading,
    loadingMore,
    items.length,
    total,
    page,
    debouncedQuery,
    pageSize,
  ]);

  const hasMore = items.length < total;
  const onFetchPage = useEffectEvent(fetchPage);

  useEffect(() => {
    if (!enabled) {
      const t = window.setTimeout(() => {
        setItems([]);
        setPage(1);
        setTotal(0);
        setError(null);
        setLoading(false);
        setLoadingMore(false);
        setHasFetched(false);
      }, 0);
      return () => window.clearTimeout(t);
    }

    const requestId = ++requestIdRef.current;

    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await onFetchPage({
            query: debouncedQuery,
            page: 1,
            pageSize,
          });
          if (requestId !== requestIdRef.current) return;
          setItems(result.items);
          setTotal(result.total);
          setPage(1);
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          setError(err instanceof Error ? err.message : "Failed to load options");
          setItems([]);
          setTotal(0);
        } finally {
          if (requestId === requestIdRef.current) {
            setLoading(false);
            setHasFetched(true);
          }
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(t);
      // Invalidate in-flight page-1 so a late response cannot overwrite newer data.
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [debouncedQuery, enabled, pageSize]);

  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (!s.enabled || s.loading || s.loadingMore || s.itemsLength >= s.total) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const nextPage = s.page + 1;

    setLoadingMore(true);
    void (async () => {
      try {
        const result = await fetchPage({
          query: s.debouncedQuery,
          page: nextPage,
          pageSize: s.pageSize,
        });
        if (requestId !== requestIdRef.current) return;
        setTotal(result.total);
        setPage(nextPage);
        setItems((prev) => [...prev, ...result.items]);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load more");
      } finally {
        if (requestId === requestIdRef.current) setLoadingMore(false);
      }
    })();
  }, [fetchPage]);

  const reset = useCallback(() => {
    setQuery("");
    setItems([]);
    setPage(1);
    setTotal(0);
    setError(null);
    setHasFetched(false);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    items,
    total,
    loading,
    loadingMore,
    error,
    hasFetched,
    hasMore,
    loadMore,
    reset,
  };
}
