import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, diffAudit } from "@/lib/audit";
import { requireAdminToManageAdmin } from "@/lib/rbac/employee-guards";
import { toEmployeeSummary } from "@/features/employees/server/serialize";

/** Clears the PIN — employee must set up a new PIN via OTP. */
export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const target = unitId
    ? await prisma.user.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!target) return jsonFail("NOT_FOUND", "Employee not found", 404);

  const manageMsg = requireAdminToManageAdmin(user, target);
  if (manageMsg) return jsonFail("FORBIDDEN", manageMsg, 403);

  const before = {
    pinConfigured: Boolean(target.pinHash),
    failedPinAttempts: target.failedPinAttempts,
    pinLockedUntil: target.pinLockedUntil?.toISOString() ?? null,
  };

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      pinHash: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  const after = {
    pinConfigured: Boolean(updated.pinHash),
    failedPinAttempts: updated.failedPinAttempts,
    pinLockedUntil: updated.pinLockedUntil?.toISOString() ?? null,
  };
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "employee.force_reset_pin",
    entity: "User",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  return jsonOk({ employee: toEmployeeSummary(updated) });
});
