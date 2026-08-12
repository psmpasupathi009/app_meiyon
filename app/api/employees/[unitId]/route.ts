import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { updateEmployeeSchema } from "@/lib/validations/employees.schema";
import {
  requireAdminToAssignAdmin,
  requireAdminToManageAdmin,
  wouldRemoveLastAdmin,
} from "@/lib/rbac/employee-guards";
import { toEmployeeSummary } from "@/features/employees/server/serialize";

const EMPLOYEE_AUDIT_KEYS = [
  "name",
  "designation",
  "roles",
  "email",
  "address",
  "isActive",
  "defaultCourts",
] as const;

async function findByUnitId(unitId: string, officeId: string) {
  return prisma.user.findFirst({ where: { unitId, officeId } });
}

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "employees", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const target = unitId ? await findByUnitId(unitId, user.officeId) : null;
  if (!target) return jsonFail("NOT_FOUND", "Employee not found", 404);

  return jsonOk({ employee: toEmployeeSummary(target) });
});

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const target = unitId ? await findByUnitId(unitId, user.officeId) : null;
  if (!target) return jsonFail("NOT_FOUND", "Employee not found", 404);

  const raw = await request.json();
  const parsed = updateEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  const nextRoles = input.roles ?? target.roles;
  const nextIsActive = input.isActive ?? target.isActive;
  const nextCourts =
    input.defaultCourts !== undefined ? input.defaultCourts : undefined;

  const manageMsg = requireAdminToManageAdmin(user, target);
  if (manageMsg) return jsonFail("FORBIDDEN", manageMsg, 403);

  const guardMsg = requireAdminToAssignAdmin(user, nextRoles);
  if (guardMsg) return jsonFail("FORBIDDEN", guardMsg, 403);

  if (target.id === user.id && input.isActive === false) {
    return jsonFail("FORBIDDEN", "You can’t deactivate your own account", 403);
  }

  if (await wouldRemoveLastAdmin(target, nextIsActive, nextRoles)) {
    return jsonFail("CONFLICT", "This is the last active admin — assign another admin first", 409);
  }

  if (nextRoles.includes("advocate")) {
    const courts =
      nextCourts !== undefined
        ? nextCourts
        : toEmployeeSummary(target).defaultCourts;
    if (courts.length === 0) {
      return jsonFail(
        "VALIDATION",
        "Advocates need at least one default court",
        400
      );
    }
  }

  const before = pickAuditFields(target as Record<string, unknown>, EMPLOYEE_AUDIT_KEYS);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      name: input.name,
      designation: input.designation,
      roles: input.roles,
      email: input.email === "" ? null : input.email,
      address: input.address === "" ? null : input.address,
      isActive: input.isActive,
      ...(nextCourts !== undefined ? { defaultCourts: nextCourts } : {}),
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, EMPLOYEE_AUDIT_KEYS);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "employee.update",
    entity: "User",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  return jsonOk({ employee: toEmployeeSummary(updated) });
});
