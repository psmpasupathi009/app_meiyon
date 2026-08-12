import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { personDisplayName } from "@/shared/lib/person";
import {
  eachIstDateInclusive,
  findAdvocateDutyClash,
  findOverlappingOverride,
} from "@/features/court-roster/lib/effective-cover";
import { batchAdvocateCourtAvailability } from "@/features/court-roster/lib/batch-availability";
import { createCourtDutyOverrideSchema } from "@/lib/validations/court-roster.schema";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "edit");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createCourtDutyOverrideSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const advocate = await prisma.user.findFirst({ where: { unitId: input.advocateUnitId, officeId: user.officeId },
  });
  if (!advocate || !advocate.isActive) {
    return jsonFail("NOT_FOUND", "Advocate not found", 404);
  }
  if (!advocate.roles.includes("advocate")) {
    return jsonFail("VALIDATION", "Selected employee is not an advocate", 400);
  }

  const existing = await prisma.courtDutyOverride.findMany({
    where: {
      toDate: { gte: input.fromDate },
      fromDate: { lte: input.toDate },
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

  const overlap = findOverlappingOverride(existing, input);
  if (overlap) {
    return jsonFail(
      "CONFLICT",
      `Another temporary cover already exists for this court (${overlap.unitId})`,
      409
    );
  }

  const dutyClash = findAdvocateDutyClash(existing, {
    ...input,
    advocateUnitId: advocate.unitId,
  });
  if (dutyClash) {
    return jsonFail(
      "CONFLICT",
      `Advocate already has temporary cover at ${dutyClash.courtName} (${dutyClash.unitId})`,
      409
    );
  }

  const days = eachIstDateInclusive(input.fromDate, input.toDate);
  if (days.length > 62) {
    return jsonFail(
      "VALIDATION",
      "Temporary cover can be at most 62 days",
      400
    );
  }

  const court = {
    state: input.state,
    district: input.district,
    city: input.city,
    courtName: input.courtName,
  };

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

  const unitId = await nextUnitId("courtDuty", user);
  const created = await prisma.courtDutyOverride.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      ...court,
      advocateUserId: advocate.id,
      advocateUnitId: advocate.unitId,
      advocateMobile: normalizeMobile(advocate.mobile) ?? advocate.mobile,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason || null,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "court_duty.create",
    entity: "CourtDutyOverride",
    entityUnitId: created.unitId,
    meta: {
      court,
      advocateUnitId: advocate.unitId,
      fromDate: created.fromDate,
      toDate: created.toDate,
      reason: created.reason,
    },
  });

  const mobile = displayMobile(created.advocateMobile);
  return jsonOk(
    {
      override: {
        unitId: created.unitId,
        ...court,
        advocateUserId: created.advocateUserId,
        advocateUnitId: created.advocateUnitId,
        advocateMobile: mobile,
        fromDate: created.fromDate,
        toDate: created.toDate,
        reason: created.reason,
        advocateName: advocate.name,
        advocateDisplayName: personDisplayName({
          name: advocate.name,
          mobile,
          unitId: advocate.unitId,
        }),
      },
    },
    201
  );
});
