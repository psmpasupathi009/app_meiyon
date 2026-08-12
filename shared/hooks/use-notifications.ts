"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import type { NotificationPayload } from "@/lib/notifications/sse-hub";
import {
  emitNotificationsChanged,
  onNotificationsChanged,
} from "@/features/notifications/lib/notifications-sync";
import { useNotificationStream } from "@/shared/hooks/use-notification-stream";

type ListEnvelope = {
  data?: NotificationPayload[];
  meta?: { total?: number };
};

type UnreadEnvelope = { unread?: number };

/** Unread badge poll (SSE is best-effort; always poll as fallback). */
const UNREAD_POLL_MS = 15_000;
const LIST_LIMIT = 20;

export function useNotifications() {
  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const listLoadedRef = useRef(false);
  const seenLive = useRef(new Set<string>());
  const knownIds = useRef(new Set<string>());
  const marking = useRef(new Set<string>());
  const skipNextSync = useRef(false);

  const refreshUnread = useCallback(async () => {
    const countRes = await apiFetch<UnreadEnvelope>(
      "/api/notifications/unread-count"
    );
    if (countRes.ok && typeof countRes.data?.unread === "number") {
      const next = countRes.data.unread;
      setUnread((prev) => {
        if (listLoadedRef.current && next > prev) {
          queueMicrotask(() => {
            void apiFetch<ListEnvelope>(
              `/api/notifications?page=1&pageSize=${LIST_LIMIT}`
            ).then((listRes) => {
              if (
                listRes.ok &&
                listRes.data &&
                typeof listRes.data === "object"
              ) {
                const rows = Array.isArray(listRes.data.data)
                  ? listRes.data.data
                  : [];
                knownIds.current = new Set(rows.map((r) => r.unitId));
                setItems(rows);
              }
            });
          });
        }
        return next;
      });
    }
  }, []);

  const refetchList = useCallback(async () => {
    setLoading(true);
    const [listRes, countRes] = await Promise.all([
      apiFetch<ListEnvelope>(
        `/api/notifications?page=1&pageSize=${LIST_LIMIT}`
      ),
      apiFetch<UnreadEnvelope>("/api/notifications/unread-count"),
    ]);

    if (listRes.ok && listRes.data && typeof listRes.data === "object") {
      const rows = Array.isArray(listRes.data.data) ? listRes.data.data : [];
      knownIds.current = new Set(rows.map((r) => r.unitId));
      setItems(rows);
    }

    if (countRes.ok && typeof countRes.data?.unread === "number") {
      setUnread(countRes.data.unread);
    }
    listLoadedRef.current = true;
    setLoading(false);
  }, []);

  /** Call when the bell dropdown opens — avoids loading the list on every page. */
  const ensureList = useCallback(async () => {
    await refetchList();
  }, [refetchList]);

  const markRead = useCallback(
    async (unitId: string) => {
      if (marking.current.has(unitId)) return true;
      marking.current.add(unitId);
      try {
        const { ok } = await apiFetch(`/api/notifications/${unitId}/read`, {
          method: "PATCH",
        });
        if (!ok) return false;
        setItems((prev) =>
          prev.map((n) =>
            n.unitId === unitId && !n.readAt
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        );
        void refreshUnread();
        skipNextSync.current = true;
        emitNotificationsChanged();
        return true;
      } finally {
        marking.current.delete(unitId);
      }
    },
    [refreshUnread]
  );

  const markAllRead = useCallback(async () => {
    const { ok } = await apiFetch("/api/notifications/read-all", {
      method: "POST",
    });
    if (!ok) return false;
    setItems((prev) =>
      prev.map((n) =>
        n.readAt ? n : { ...n, readAt: new Date().toISOString() }
      )
    );
    setUnread(0);
    skipNextSync.current = true;
    emitNotificationsChanged();
    return true;
  }, []);

  const prependLive = useCallback(
    (payload: NotificationPayload) => {
      if (seenLive.current.has(payload.unitId)) return;
      seenLive.current.add(payload.unitId);

      if (!knownIds.current.has(payload.unitId)) {
        knownIds.current.add(payload.unitId);
        setItems((prev) => [payload, ...prev].slice(0, LIST_LIMIT));
      }

      void refreshUnread();
      if (!payload.readAt) {
        toast.message(payload.title);
      }
    },
    [refreshUnread]
  );

  // Badge only on mount — do not fetch the full list until the menu opens.
  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    return onNotificationsChanged(() => {
      if (skipNextSync.current) {
        skipNextSync.current = false;
        return;
      }
      void refreshUnread();
      if (listLoadedRef.current) void refetchList();
    });
  }, [refreshUnread, refetchList]);

  // Always poll unread as fallback (SSE hub is in-process and can miss on serverless).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnread();
    }, UNREAD_POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshUnread]);

  useNotificationStream(prependLive);

  return {
    items,
    unread,
    loading,
    ensureList,
    refetch: refetchList,
    markRead,
    markAllRead,
  };
}
