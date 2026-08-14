import type { Prisma } from "@prisma/client";
import {
  apiHandler,
  jsonFail,
  jsonOk,
  jsonOkList,
  parsePagination,
} from "@/lib/api/response";
import { requirePerm, requireUser } from "@/lib/api/guard";
import { hasPermission, requireModuleEnabled } from "@/lib/rbac";
import { requirePlanModule } from "@/lib/auth/plan-gate";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { createOfficeHolidaySchema } from "@/lib/validations/hrms.schema";
import {
  toOfficeHolidaySummary,
} from "@/features/hrms/lib/office-holiday";
import {
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";
import { istDateKey, istAddCalendarDays } from "@/lib/utils/ist";

async function notifyHoliday(
  holiday: { title: string; fromDate: string; toDate: string; notes: string | null },
  action: "created" | "updated",
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
        title: `Office holiday: ${holiday.title}`,
        body:
          action === "created"
            ? `Office closed ${range}${holiday.notes ? ` — ${holiday.notes}` : ""}. Check-in and booking are blocked.`
            : `Holiday updated: ${holiday.title} (${range}).`,
        href: "/hrms?section=holidays",
      }))
    )
  );
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;
  const modFail = requireModuleEnabled("hrms");
  if (modFail) return modFail;
  const canView =
    (await hasPermission(user, "hrms", "view")) ||
    (await hasPermission(user, "hrms", "own_attendance")) ||
    (await hasPermission(user, "hrms", "manage_attendance"));
  if (!canView) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const from =
    searchParams.get("from")?.trim() || istAddCalendarDays(istDateKey(), -30);
  const to =
    searchParams.get("to")?.trim() || istAddCalendarDays(istDateKey(), 365);

  const where: Prisma.OfficeHolidayWhereInput = {
    officeId: user.officeId,
    fromDate: { lte: to },
    toDate: { gte: from },
  };

  const [rows, total] = await Promise.all([
    prisma.officeHoliday.findMany({
      where,
      orderBy: { fromDate: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.officeHoliday.count({ where }),
  ]);

  return jsonOkList(rows.map(toOfficeHolidaySummary), {
    page,
    pageSize,
    total,
  });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(
    request,
    "hrms",
    "manage_attendance"
  );
  if (!user) return response;

  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const raw = await request.json();
  const parsed = createOfficeHolidaySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const overlap = await prisma.officeHoliday.findFirst({
    where: {
      fromDate: { lte: input.toDate },
      toDate: { gte: input.fromDate },
    },
  });
  if (overlap) {
    return jsonFail(
      "CONFLICT",
      `Overlaps existing holiday “${overlap.title}” (${overlap.fromDate}–${overlap.toDate})`,
      409
    );
  }

  const unitId = await nextUnitId("holiday", user);
  const row = await prisma.officeHoliday.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      title: input.title,
      notes: input.notes || null,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "holiday.create",
    entity: "OfficeHoliday",
    entityUnitId: row.unitId,
    meta: {
      after: pickAuditFields(row as Record<string, unknown>, [
        "fromDate",
        "toDate",
        "title",
        "notes",
      ] as const),
    },
  });

  await notifyHoliday(
    {
      title: row.title,
      fromDate: row.fromDate,
      toDate: row.toDate,
      notes: row.notes,
    },
    "created",
    { officeId: user.officeId, officeUnitId: user.officeUnitId }
  );

  return jsonOk({ holiday: toOfficeHolidaySummary(row) }, 201);
});
