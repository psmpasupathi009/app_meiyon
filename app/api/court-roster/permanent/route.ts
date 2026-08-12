import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { toEmployeeSummary } from "@/features/employees/server/serialize";
import {
  addCourtToDefaults,
  parseAdvocateDefaults,
  removeCourtFromDefaults,
} from "@/features/court-roster/lib/effective-cover";
import { permanentCourtAssignSchema } from "@/lib/validations/court-roster.schema";

/**
 * Add or remove a court on an advocate's permanent defaultCourts list.
 */
export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const raw = await request.json();
  const parsed = permanentCourtAssignSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const target = await prisma.user.findFirst({ where: { unitId: input.advocateUnitId, officeId: user.officeId },
  });
  if (!target) return jsonFail("NOT_FOUND", "Employee not found", 404);
  if (!target.roles.includes("advocate")) {
    return jsonFail("VALIDATION", "Selected employee is not an advocate", 400);
  }

  const court = {
    state: input.state,
    district: input.district,
    city: input.city,
    courtName: input.courtName,
  };
  const existing = parseAdvocateDefaults(target.defaultCourts);
  const next =
    input.action === "add"
      ? addCourtToDefaults(existing, court)
      : removeCourtFromDefaults(existing, court);

  if (input.action === "remove" && target.roles.includes("advocate") && next.length === 0) {
    return jsonFail(
      "VALIDATION",
      "Advocates need at least one default court",
      400
    );
  }

  if (input.action === "add" && next.length === existing.length) {
    return jsonOk({ employee: toEmployeeSummary(target), unchanged: true });
  }

  const before = pickAuditFields(target as Record<string, unknown>, [
    "defaultCourts",
  ] as const);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { defaultCourts: next },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, [
    "defaultCourts",
  ] as const);

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "court_roster.permanent",
    entity: "User",
    entityUnitId: updated.unitId,
    meta: {
      action: input.action,
      court,
      before,
      after,
      changes: diffAudit(before, after),
    },
  });

  return jsonOk({ employee: toEmployeeSummary(updated), unchanged: false });
});
