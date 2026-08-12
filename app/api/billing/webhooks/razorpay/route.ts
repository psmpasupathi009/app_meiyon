import { handleRazorpayWebhook, verifyRazorpayWebhookSignature } from "@meiyon/billing";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";

export const POST = apiHandler(async (request) => {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(body, signature)) {
    return jsonFail("UNAUTHORIZED", "Invalid webhook signature", 401);
  }

  let payload: { event?: string; id?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonFail("VALIDATION", "Invalid JSON body", 400);
  }

  const eventId =
    payload.id ??
    request.headers.get("x-razorpay-event-id") ??
    `evt_${Date.now()}`;

  if (!payload.event) {
    return jsonFail("VALIDATION", "Missing event", 400);
  }

  await handleRazorpayWebhook(eventId, {
    event: payload.event,
    payload: (payload as { payload?: unknown }).payload as never,
  });

  return jsonOk({ received: true });
});
