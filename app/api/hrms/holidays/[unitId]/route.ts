import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { updateOfficeHolidaySchema } from "@/lib/validations/hrms.schema";
import { toOfficeHolidaySummary } from "@/features/hrms/lib/office-holiday";
import {
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

const HOLIDAY_AUDIT_KEYS = ["fromDate", "toDate", "title", "notes"] as const;

async function notifyHolidayUpdate(
  holiday: {
    title: string;
    fromDate: string;
    toDate: string;
    notes: string | null;
  },
  office: { officeId: string; officeUnitId: string }
) {
  const users = await prisma.user.findMany({
    where: { officeId: office.officeId, isActive: true },
    select: { id: true, unitId: true },
  });
  const range =
    holiday.fromDate === holiday.toDate
      ? holiday.fromDate
      : `${holiday.fromDate} → ${holiday.toDate}`;
  scheduleNotify(() =>
    notifyUsers(
      users.map((u) => ({
        officeId: office.officeId,
        officeUnitId: office.officeUnitId,
        userId: u.id,
        userUnitId: u.unitId,
        type: "office_holiday",
        title: `Office holiday updated: ${holiday.title}`,
        body: `Dates: ${range}${holiday.notes ? ` — ${holiday.notes}` : ""}`,
        href: "/hrms?section=holidays",
      }))
    )
  );
}

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(
    request,
    "hrms",
    "manage_attendance"
  );
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.officeHoliday.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Holiday not found", 404);

  const raw = await request.json();
  const parsed = updateOfficeHolidaySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;
  const nextFrom = input.fromDate ?? item.fromDate;
  const nextTo = input.toDate ?? item.toDate;
  if (nextFrom > nextTo) {
    return jsonFail("VALIDATION", "From date must be on/before to date", 400);
  }

  const overlap = await prisma.officeHoliday.findFirst({
    where: {
      id: { not: item.id },
      fromDate: { lte: nextTo },
      toDate: { gte: nextFrom },
    },
  });
  if (overlap) {
    return jsonFail(
      "CONFLICT",
      `Overlaps existing holiday “${overlap.title}”`,
      409
    );
  }

  const before = pickAuditFields(item as Record<string, unknown>, HOLIDAY_AUDIT_KEYS);

  const updated = await prisma.officeHoliday.update({
    where: { id: item.id },
    data: {
      fromDate: input.fromDate,
      toDate: input.toDate,
      title: input.title,
      notes:
        input.notes === undefined
          ? undefined
          : input.notes === ""
            ? null
            : input.notes,
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, HOLIDAY_AUDIT_KEYS);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "holiday.update",
    entity: "OfficeHoliday",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  const datesChanged =
    updated.fromDate !== item.fromDate || updated.toDate !== item.toDate;
  if (datesChanged || (input.title && input.title !== item.title)) {
    await notifyHolidayUpdate(
      {
        title: updated.title,
        fromDate: updated.fromDate,
        toDate: updated.toDate,
        notes: updated.notes,
      },
      { officeId: user.officeId, officeUnitId: user.officeUnitId }
    );
  }

  return jsonOk({ holiday: toOfficeHolidaySummary(updated) });
});

export const DELETE = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(
    request,
    "hrms",
    "manage_attendance"
  );
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.officeHoliday.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Holiday not found", 404);

  await prisma.officeHoliday.delete({ where: { id: item.id } });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "holiday.delete",
    entity: "OfficeHoliday",
    entityUnitId: item.unitId,
    meta: {
      before: pickAuditFields(item as Record<string, unknown>, HOLIDAY_AUDIT_KEYS),
    },
  });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, unitId: true },
  });
  const range =
    item.fromDate === item.toDate
      ? item.fromDate
      : `${item.fromDate} → ${item.toDate}`;
  scheduleNotify(() =>
    notifyUsers(
      users
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "office_holiday",
          title: `Office holiday removed: ${item.title}`,
          body: `Was: ${range}`,
          href: "/hrms?section=holidays",
        }))
    )
  );

  return jsonOk({ deleted: true });
});
