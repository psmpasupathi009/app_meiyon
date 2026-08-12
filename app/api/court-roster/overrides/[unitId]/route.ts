import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit } from "@/lib/audit";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { personDisplayName } from "@/shared/lib/person";
import { istDateKey } from "@/lib/utils/ist";
import {
  eachIstDateInclusive,
  findAdvocateDutyClash,
  findOverlappingOverride,
  resolveEndOverride,
} from "@/features/court-roster/lib/effective-cover";
import { batchAdvocateCourtAvailability } from "@/features/court-roster/lib/batch-availability";
import { updateCourtDutyOverrideSchema } from "@/lib/validations/court-roster.schema";

async function findOverride(unitId: string, officeId: string) {
  return prisma.courtDutyOverride.findFirst({ where: { unitId, officeId } });
}

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const target = unitId ? await findOverride(unitId, user.officeId) : null;
  if (!target) return jsonFail("NOT_FOUND", "Override not found", 404);

  const raw = await request.json();
  const parsed = updateCourtDutyOverrideSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const fromDate = input.fromDate ?? target.fromDate;
  const toDate = input.toDate ?? target.toDate;
  if (fromDate > toDate) {
    return jsonFail("VALIDATION", "End date must be on or after start date", 400);
  }

  let advocate = await prisma.user.findUnique({
    where: { id: target.advocateUserId },
  });
  if (input.advocateUnitId) {
    advocate = await prisma.user.findFirst({ where: { unitId: input.advocateUnitId, officeId: user.officeId },
    });
  }
  if (!advocate || !advocate.isActive) {
    return jsonFail("NOT_FOUND", "Advocate not found", 404);
  }
  if (!advocate.roles.includes("advocate")) {
    return jsonFail("VALIDATION", "Selected employee is not an advocate", 400);
  }

  const existing = await prisma.courtDutyOverride.findMany({
    where: {
      toDate: { gte: fromDate },
      fromDate: { lte: toDate },
    },
    select: {
      unitId: true,
      state: true,
      district: true,
      city: true,
      courtName: true,
      fromDate: true,
      toDate: true,
      advocateUnitId: true,
    },
  });

  const court = {
    state: target.state,
    district: target.district,
    city: target.city,
    courtName: target.courtName,
  };

  const overlap = findOverlappingOverride(
    existing,
    { ...court, fromDate, toDate },
    target.unitId
  );
  if (overlap) {
    return jsonFail(
      "CONFLICT",
      `Another temporary cover already exists for this court (${overlap.unitId})`,
      409
    );
  }

  const dutyClash = findAdvocateDutyClash(
    existing,
    {
      ...court,
      fromDate,
      toDate,
      advocateUnitId: advocate.unitId,
    },
    target.unitId
  );
  if (dutyClash) {
    return jsonFail(
      "CONFLICT",
      `Advocate already has temporary cover at ${dutyClash.courtName} (${dutyClash.unitId})`,
      409
    );
  }

  const days = eachIstDateInclusive(fromDate, toDate);
  if (days.length > 62) {
    return jsonFail("VALIDATION", "Temporary cover can be at most 62 days", 400);
  }

  const availability = await batchAdvocateCourtAvailability({
    advocates: [advocate],
    days,
    court,
  });
  const hit = availability.get(advocate.unitId);
  if (hit && !hit.available) {
    return jsonFail(
      "CONFLICT",
      `${hit.message ?? "Advocate not available"}${hit.day ? ` on ${hit.day}` : ""}`,
      409,
      { day: hit.day, reason: hit.reason, detail: hit.detail }
    );
  }

  const updated = await prisma.courtDutyOverride.update({
    where: { id: target.id },
    data: {
      fromDate,
      toDate,
      advocateUserId: advocate.id,
      advocateUnitId: advocate.unitId,
      advocateMobile: normalizeMobile(advocate.mobile) ?? advocate.mobile,
      ...(input.reason !== undefined
        ? { reason: input.reason || null }
        : {}),
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "court_duty.update",
    entity: "CourtDutyOverride",
    entityUnitId: updated.unitId,
    meta: {
      before: {
        fromDate: target.fromDate,
        toDate: target.toDate,
        advocateUnitId: target.advocateUnitId,
      },
      after: {
        fromDate: updated.fromDate,
        toDate: updated.toDate,
        advocateUnitId: updated.advocateUnitId,
      },
    },
  });

  const mobile = displayMobile(updated.advocateMobile);
  return jsonOk({
    override: {
      unitId: updated.unitId,
      ...court,
      advocateUserId: updated.advocateUserId,
      advocateUnitId: updated.advocateUnitId,
      advocateMobile: mobile,
      fromDate: updated.fromDate,
      toDate: updated.toDate,
      reason: updated.reason,
      advocateName: advocate.name,
      advocateDisplayName: personDisplayName({
        name: advocate.name,
        mobile,
        unitId: advocate.unitId,
      }),
    },
  });
});

export const DELETE = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const target = unitId ? await findOverride(unitId, user.officeId) : null;
  if (!target) return jsonFail("NOT_FOUND", "Override not found", 404);

  const today = istDateKey();
  const resolution = resolveEndOverride({
    fromDate: target.fromDate,
    toDate: target.toDate,
    today,
  });

  if (resolution.action === "truncate") {
    const updated = await prisma.courtDutyOverride.update({
      where: { id: target.id },
      data: { toDate: resolution.toDate },
    });

    await writeAudit({
      officeId: user.officeId,
      actorUnitId: user.unitId,
      action: "court_duty.end_early",
      entity: "CourtDutyOverride",
      entityUnitId: updated.unitId,
      meta: {
        before: { fromDate: target.fromDate, toDate: target.toDate },
        after: { fromDate: updated.fromDate, toDate: updated.toDate },
        endedOn: today,
      },
    });

    return jsonOk({
      ended: true,
      truncated: true,
      unitId: updated.unitId,
      toDate: updated.toDate,
    });
  }

  await prisma.courtDutyOverride.delete({ where: { id: target.id } });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "court_duty.delete",
    entity: "CourtDutyOverride",
    entityUnitId: target.unitId,
    meta: {
      court: {
        state: target.state,
        district: target.district,
        city: target.city,
        courtName: target.courtName,
      },
      fromDate: target.fromDate,
      toDate: target.toDate,
      endedOn: today,
    },
  });

  return jsonOk({ ended: true, deleted: true, unitId: target.unitId });
});
