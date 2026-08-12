/** Cross-surface + cross-tab sync between header bell and inbox page. */
export const NOTIFICATIONS_CHANGED_EVENT = "mlf:notifications-changed";
const CHANNEL_NAME = "mlf-notifications";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function emitNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  try {
    getChannel()?.postMessage({ type: "changed" });
  } catch {
    /* ignore */
  }
}

export function onNotificationsChanged(handler: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);

  const bc = getChannel();
  const onMessage = () => handler();
  bc?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
    bc?.removeEventListener("message", onMessage);
  };
}
