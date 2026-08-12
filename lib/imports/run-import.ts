import type { User } from "@prisma/client";
import type { ZodType } from "zod";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { compliance } from "@/config/company/compliance";
import { assertImportRateLimit } from "@/lib/rate-limit/guards";
import { findIgnoredImportColumns } from "@/lib/imports/columns";
import { isClientOnlyUser } from "@/lib/auth/client-portal";

export type ImportRowResult = {
  row: number;
  unitId: string | null;
  status: "ok" | "error";
  message: string;
};

export type ImportContext = {
  user: User;
  dryRun: boolean;
  /** True when `editPerm` was granted (upsert domains). */
  canEdit: boolean;
};

export type ImportProcessResult =
  | ImportRowResult[]
  | { results: ImportRowResult[]; auditMeta?: Record<string, unknown> };

type ImportHandlerOptions<TRow> = {
  perm: readonly [module: string, action: string];
  /** Optional upsert gate — exposed as `ctx.canEdit`. */
  editPerm?: readonly [module: string, action: string];
  schema: ZodType<{ dryRun: boolean; rows: TRow[] }, any, any>;
  columns: readonly string[];
  audit: { action: string; entity: string };
  processRows: (
    rows: TRow[],
    ctx: ImportContext
  ) => Promise<ImportProcessResult>;
};

function normalizeProcessResult(
  processed: ImportProcessResult
): { results: ImportRowResult[]; auditMeta: Record<string, unknown> } {
  if (Array.isArray(processed)) {
    return { results: processed, auditMeta: {} };
  }
  return { results: processed.results, auditMeta: processed.auditMeta ?? {} };
}

/** Shared CSV import wrapper: auth, rate limit, Zod, maxRows, audit, response. */
export function createImportHandler<TRow extends Record<string, string>>(
  options: ImportHandlerOptions<TRow>
) {
  return apiHandler(async (request) => {
    const { user, response } = await requirePerm(
      request,
      options.perm[0],
      options.perm[1]
    );
    if (!user) return response;

    // CSV import is staff-only — clients share upload/create perms for self-service files.
    if (isClientOnlyUser(user.roles)) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }

    const limited = await assertImportRateLimit(request, user.unitId);
    if (limited) return limited;

    const canEdit = options.editPerm
      ? await hasPermission(user, options.editPerm[0], options.editPerm[1])
      : false;

    const raw = await request.json();
    const ignoredColumns = Array.isArray(raw?.rows)
      ? findIgnoredImportColumns(
          raw.rows as Record<string, string>[],
          options.columns
        )
      : [];
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request",
        400,
        parsed.error.issues
      );
    }
    const { dryRun, rows } = parsed.data;

    if (rows.length > compliance.csv.maxRows) {
      return jsonFail(
        "VALIDATION",
        `Max ${compliance.csv.maxRows} rows per import`,
        400
      );
    }

    const { results, auditMeta } = normalizeProcessResult(
      await options.processRows(rows, { user, dryRun, canEdit })
    );
    const succeeded = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    if (!dryRun) {
      await writeAudit({
        officeId: user.officeId,
        actorUnitId: user.unitId,
        action: options.audit.action,
        entity: options.audit.entity,
        meta: {
          total: rows.length,
          succeeded,
          failed,
          ...auditMeta,
        },
      });
    }

    return jsonOk({
      dryRun,
      total: rows.length,
      succeeded,
      failed,
      results,
      ignoredColumns,
    });
  });
}
