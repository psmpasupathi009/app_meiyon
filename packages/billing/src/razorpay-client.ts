import { getRazorpayKeyId, getRazorpayKeySecret } from "./env";

function authHeader(): string {
  const key = getRazorpayKeyId();
  const secret = getRazorpayKeySecret();
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function razorpayRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: { description?: string } })?.error?.description ??
        `Razorpay API error (${res.status})`
    );
  }
  return data as T;
}

export const razorpayApi = {
  plans: {
    create: (body: Record<string, unknown>) =>
      razorpayRequest<{ id: string }>("POST", "/plans", body),
  },
  customers: {
    create: (body: Record<string, unknown>) =>
      razorpayRequest<{ id: string }>("POST", "/customers", body),
  },
  subscriptions: {
    create: (body: Record<string, unknown>) =>
      razorpayRequest<{ id: string }>("POST", "/subscriptions", body),
    cancel: (id: string, body: Record<string, unknown>) =>
      razorpayRequest<{ id: string }>("POST", `/subscriptions/${id}/cancel`, body),
  },
};

/** @deprecated use razorpayApi — kept for compatibility */
export function getRazorpayClient() {
  return razorpayApi;
}
