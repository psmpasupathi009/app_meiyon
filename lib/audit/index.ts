import type { Prisma } from "@prisma/client";
import { prisma } from "@meiyon/db";

const REDACT_KEYS = new Set([
  "pinHash",
  "pin",
  "otpSecret",
  "otpHash",
  "password",
  "token",
  "refreshToken",
  "accessToken",
  "buffer",
  "bytes",
  "file",
  "photoBytes",
]);

export type AuditChangeMap = Record<string, { from: unknown; to: unknown }>;

export type AuditMeta = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: AuditChangeMap;
  system?: boolean;
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Strip secrets and oversized blobs before persisting audit meta. */
export function redactForAudit(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(redactForAudit);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(k)) continue;
      if (typeof v === "string" && v.length > 2000) {
        out[k] = `${v.slice(0, 2000)}…`;
        continue;
      }
      out[k] = redactForAudit(v);
    }
    return out;
  }
  return value;
}

export function pickAuditFields<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly (keyof T & string)[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = obj[key];
    if (raw instanceof Date) {
      out[key] = raw.toISOString();
    } else {
      out[key] = raw === undefined ? null : raw;
    }
  }
  return redactForAudit(out) as Record<string, unknown>;
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Build only fields that changed between before and after snapshots. */
export function diffAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): AuditChangeMap {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChangeMap = {};
  for (const key of keys) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (!stableEqual(from, to)) {
      changes[key] = { from, to };
    }
  }
  return changes;
}

export function hasAuditChanges(changes: AuditChangeMap | undefined): boolean {
  return Boolean(changes && Object.keys(changes).length > 0);
}

function isNoOpUpdateMeta(meta: unknown): boolean {
  if (!isPlainObject(meta)) return false;
  if (!("before" in meta) || !("after" in meta) || !("changes" in meta)) {
    return false;
  }
  const changes = meta.changes;
  return isPlainObject(changes) && Object.keys(changes).length === 0;
}

/**
 * Persist an audit row. Never throws — mutations must not fail because
 * logging failed after a successful write. Skips no-op updates (empty changes).
 */
export async function writeAudit(input: {
  officeId?: string;
  actorUnitId?: string | null;
  action: string;
  entity: string;
  entityUnitId?: string | null;
  meta?: AuditMeta | Prisma.InputJsonValue;
}): Promise<void> {
  if (isNoOpUpdateMeta(input.meta)) return;
  if (!input.officeId) return;

  try {
    const meta = input.meta
      ? (redactForAudit(input.meta) as Prisma.InputJsonValue)
      : undefined;
    await prisma.auditLog.create({
      data: {
        officeId: input.officeId,
        actorUnitId: input.actorUnitId ?? null,
        action: input.action,
        entity: input.entity,
        entityUnitId: input.entityUnitId ?? null,
        meta,
      },
    });
  } catch (error) {
    console.error("writeAudit failed", {
      action: input.action,
      entity: input.entity,
      entityUnitId: input.entityUnitId ?? null,
      error,
    });
  }
}
