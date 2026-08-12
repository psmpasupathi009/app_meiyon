import type { UserRole } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, type AuditChangeMap } from "@/lib/audit";
import { ensureDefaultPermissions } from "@/lib/rbac";
import {
  EMPLOYEE_ROLES,
  PERMISSION_CATALOG,
} from "@meiyon/config";
import { permissionsMatrixPutSchema } from "@/lib/validations/employees.schema";

const ALL_ROLES: UserRole[] = [...EMPLOYEE_ROLES];

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "permissions", "view");
  if (!user) return response;

  const didSeed = await ensureDefaultPermissions(user.officeId);
  const rows = await prisma.rolePermission.findMany({
    where: { officeId: user.officeId, role: { in: ALL_ROLES } },
  });

  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(`${row.role}.${row.module}.${row.action}`, row.allowed);
  }

  const matrix = ALL_ROLES.map((role) => ({
    role,
    permissions: PERMISSION_CATALOG.map(({ module, action }) => ({
      module,
      action,
      allowed: map.get(`${role}.${module}.${action}`) ?? false,
    })),
  }));

  return jsonOk({
    catalog: PERMISSION_CATALOG,
    roles: ALL_ROLES,
    matrix,
    seeded: didSeed,
  });
});

export const PUT = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "permissions", "edit");
  if (!user) return response;

  const raw = await request.json();
  const parsed = permissionsMatrixPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }

  const adminRows = parsed.data.rows.filter((r) => r.role === "admin");
  const adminHasAllAccess = PERMISSION_CATALOG.every(({ module, action }) =>
    adminRows.some((r) => r.module === module && r.action === action && r.allowed)
  );
  if (adminRows.length > 0 && !adminHasAllAccess) {
    return jsonFail("VALIDATION", "The admin role must keep full access to every module", 400);
  }

  const existing = await prisma.rolePermission.findMany({
    where: {
      officeId: user.officeId,
      OR: parsed.data.rows.map((row) => ({
        role: row.role,
        module: row.module,
        action: row.action,
      })),
    },
  });
  const existingMap = new Map(
    existing.map((r) => [`${r.role}.${r.module}.${r.action}`, r.allowed])
  );
  const cellChanges: AuditChangeMap = {};
  for (const row of parsed.data.rows) {
    const key = `${row.role}.${row.module}.${row.action}`;
    const prev = existingMap.get(key);
    const from = prev === undefined ? null : prev;
    if (from !== row.allowed) {
      cellChanges[key] = { from, to: row.allowed };
    }
  }

  for (const row of parsed.data.rows) {
    await prisma.rolePermission.upsert({
      where: {
        officeId_role_module_action: {
          officeId: user.officeId,
          role: row.role,
          module: row.module,
          action: row.action,
        },
      },
      create: { ...row, officeId: user.officeId },
      update: { allowed: row.allowed },
    });
  }

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "permissions.matrix_update",
    entity: "RolePermission",
    meta: {
      rowsChanged: parsed.data.rows.length,
      changes: cellChanges,
    },
  });

  return jsonOk({ updated: parsed.data.rows.length });
});
