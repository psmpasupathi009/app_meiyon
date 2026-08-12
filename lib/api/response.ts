import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { isDbUnreachableError } from "@/lib/db/unreachable";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "DB_UNAVAILABLE"
  | "PIN_LOCKED"
  | "INVALID_CREDENTIALS"
  | string;

export type ApiErrorBody = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type ApiListBody<T> = {
  ok: true;
  data: T[];
  meta: PaginationMeta;
};

export function jsonOk<T>(data: T, status = 200): NextResponse {
  const body: ApiSuccessBody<T> = { ok: true, data };
  return NextResponse.json(body, { status });
}

export function jsonOkList<T>(
  data: T[],
  meta: PaginationMeta,
  status = 200
): NextResponse {
  const body: ApiListBody<T> = { ok: true, data, meta };
  return NextResponse.json(body, { status });
}

export function jsonFail(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  const body: ApiErrorBody = {
    ok: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function parseBody<T>(
  schema: ZodType<T>,
  raw: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request",
        400,
        parsed.error.issues
      ),
    };
  }
  return { success: true, data: parsed.data };
}

export function zodErrorResponse(error: ZodError): NextResponse {
  return jsonFail(
    "VALIDATION",
    error.issues[0]?.message ?? "Invalid request",
    400,
    error.issues
  );
}

type HandlerContext = {
  params?: Promise<Record<string, string>>;
};

type RouteHandler = (
  request: Request,
  context: HandlerContext
) => Promise<Response> | Response;

/**
 * Thin wrapper: catch unexpected errors → unified SERVER_ERROR envelope.
 * Auth / perm / zod still live in each route (or helpers) for clarity.
 */
export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("apiHandler error", error);
      if (isDbUnreachableError(error)) {
        return jsonFail(
          "DB_UNAVAILABLE",
          "Database unreachable. Check DATABASE_URL and that MongoDB Atlas is reachable.",
          503
        );
      }
      return jsonFail("SERVER_ERROR", "Something went wrong", 500);
    }
  };
}
