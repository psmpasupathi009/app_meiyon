type ApiEnvelope = {
  ok?: boolean;
  data?: unknown;
  meta?: unknown;
  error?: { code?: string; message?: string } | string;
  message?: string;
  code?: string;
  [key: string]: unknown;
};

async function parseJson(res: Response): Promise<ApiEnvelope> {
  try {
    return (await res.json()) as ApiEnvelope;
  } catch {
    return {};
  }
}

/** Unwrap `{ ok, data }` or legacy flat payloads. */
export function unwrapData<T>(body: ApiEnvelope): T {
  if (body && typeof body === "object" && body.ok === true && body.data != null) {
    return body.data as T;
  }
  return body as T;
}

/**
 * Success payloads: unwrap `data` for single resources; for list envelopes
 * keep `data` + `meta` and any extras (e.g. accounts `summary`).
 */
function unwrapSuccess<T>(raw: ApiEnvelope): T {
  if (raw.meta != null) {
    // Strip envelope keys; keep data/meta and extras (e.g. summary).
    const rest = { ...raw };
    delete rest.ok;
    delete rest.error;
    delete rest.message;
    delete rest.code;
    return rest as T;
  }
  return raw.data as T;
}

export function getErrorMessage(data: unknown, fallback: string): string {
  const body = data as ApiEnvelope;
  if (body?.error && typeof body.error === "object" && body.error.message) {
    return body.error.message;
  }
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.message === "string") return body.message;
  return fallback;
}

export function getErrorCode(data: unknown): string | undefined {
  const body = data as ApiEnvelope;
  if (body?.error && typeof body.error === "object" && body.error.code) {
    return body.error.code;
  }
  if (typeof body?.code === "string") return body.code;
  return undefined;
}

/** Pull `retryAfterSec` from `{ error: { details } }` envelopes. */
export function getRetryAfterSec(data: unknown): number | undefined {
  const body = data as ApiEnvelope;
  const details =
    body?.error && typeof body.error === "object"
      ? (body.error as { details?: { retryAfterSec?: unknown } }).details
      : undefined;
  const n = details?.retryAfterSec;
  return typeof n === "number" && n > 0 ? Math.ceil(n) : undefined;
}

/** Lightweight JSON POST with credentials (web cookies) + timeout. */
export async function authFetch<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await parseJson(res);
    const data =
      res.ok && raw.ok === true && raw.data != null
        ? unwrapSuccess<T>(raw)
        : ((raw.ok === false ? raw : unwrapData<T>(raw)) as T);

    return { ok: res.ok && raw.ok !== false, status: res.status, data };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      data: {
        error: aborted
          ? "Server took too long (often MongoDB Atlas unreachable — check DATABASE_URL)."
          : "Network error. Please try again.",
      } as T,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Portal fetch with credentials. Prefer this over raw fetch for authenticated API calls.
 */
export async function apiFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit & { json?: Record<string, unknown> },
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init?.headers);
    if (init?.json) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(path, {
      ...init,
      headers,
      body: init?.json ? JSON.stringify(init.json) : init?.body,
      credentials: "include",
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await parseJson(res);
    const data =
      res.ok && raw.ok === true && raw.data != null
        ? unwrapSuccess<T>(raw)
        : ((raw.ok === false ? raw : unwrapData<T>(raw)) as T);

    if (
      typeof window !== "undefined" &&
      !path.startsWith("/api/auth/") &&
      (res.status === 401 || getErrorCode(raw) === "UNAUTHORIZED")
    ) {
      window.location.assign("/api/auth/session-expired");
    }

    return { ok: res.ok && raw.ok !== false, status: res.status, data };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      data: {
        error: aborted
          ? "Server took too long (often MongoDB Atlas unreachable — check DATABASE_URL)."
          : "Network error. Please try again.",
      } as T,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Authenticated file download. */
export async function apiDownload(
  path: string,
  filename: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      const raw = await parseJson(res);
      if (
        typeof window !== "undefined" &&
        !path.startsWith("/api/auth/") &&
        (res.status === 401 || getErrorCode(raw) === "UNAUTHORIZED")
      ) {
        window.location.assign("/api/auth/session-expired");
      }
      return {
        ok: false,
        error: getErrorMessage(raw, "Download failed"),
      };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
