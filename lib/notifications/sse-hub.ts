export type NotificationType =
  | "leave_request"
  | "leave_decided"
  | "leave_cancelled"
  | "task_assigned"
  | "task_done"
  | "appointment"
  | "appointment_updated"
  | "appointment_cancelled"
  | "case_status"
  | "case_created"
  | "filing_defect"
  | "batta_due"
  | "hearing_tomorrow"
  | "hearing_adjourned"
  | "office_holiday"
  | "dak_received"
  | "document_uploaded"
  | "payment_recorded"
  | "payment_voided"
  | "employee_deactivated"
  | "permissions_changed"
  | "system";

export type NotificationPayload = {
  unitId: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  href: string | null;
  meta?: unknown;
  createdAt: string;
  readAt: string | null;
};

type SseController = ReadableStreamDefaultController<Uint8Array>;

const enc = new TextEncoder();

/** In-process SSE subscribers keyed by userId. Fine for single Node instance. */
const hubs = new Map<string, Set<SseController>>();

export function subscribeNotifications(
  userId: string,
  controller: SseController
): () => void {
  let set = hubs.get(userId);
  if (!set) {
    set = new Set();
    hubs.set(userId, set);
  }
  set.add(controller);
  return () => {
    set!.delete(controller);
    if (set!.size === 0) hubs.delete(userId);
  };
}

export function publishNotification(
  userId: string,
  payload: NotificationPayload
) {
  const set = hubs.get(userId);
  if (!set || set.size === 0) return;
  const chunk = enc.encode(
    `event: notification\ndata: ${JSON.stringify(payload)}\n\n`
  );
  for (const controller of [...set]) {
    try {
      controller.enqueue(chunk);
    } catch {
      set.delete(controller);
    }
  }
}

export function sseHeartbeatChunk(): Uint8Array {
  return enc.encode(`: ping\n\n`);
}
