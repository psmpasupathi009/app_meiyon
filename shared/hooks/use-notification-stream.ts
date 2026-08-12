"use client";

import { useEffect, useRef } from "react";
import type { NotificationPayload } from "@/lib/notifications/sse-hub";

/** True when live SSE is opted in (in-memory hub does not work across serverless isolates). */
export function isNotificationSseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SSE === "1";
}

/**
 * Shared EventSource connection for notifications.
 * No-op unless `NEXT_PUBLIC_ENABLE_SSE=1`.
 */
export function useNotificationStream(
  onPayload: (payload: NotificationPayload) => void
) {
  const onPayloadRef = useRef(onPayload);
  useEffect(() => {
    onPayloadRef.current = onPayload;
  }, [onPayload]);

  useEffect(() => {
    if (!isNotificationSseEnabled()) return;

    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/notifications/stream", {
        withCredentials: true,
      });

      es.addEventListener("notification", (ev) => {
        try {
          const payload = JSON.parse(
            (ev as MessageEvent).data
          ) as NotificationPayload;
          onPayloadRef.current(payload);
        } catch {
          /* ignore malformed */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) {
          retryTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);
}
