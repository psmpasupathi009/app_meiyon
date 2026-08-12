import { requireUser } from "@/lib/api/guard";
import {
  subscribeNotifications,
  sseHeartbeatChunk,
} from "@/lib/notifications/sse-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for the current user's notifications.
 * Client: new EventSource("/api/notifications/stream")
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response!;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      cleanup = subscribeNotifications(user.id, controller);
      controller.enqueue(
        encoder.encode(
          `event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`
        )
      );
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(sseHeartbeatChunk());
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 25000);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
