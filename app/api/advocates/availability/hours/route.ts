import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import {
  CLOSED_WEEK_SENTINEL,
  loadWeeklyHours,
  timeToMinutes,
} from "@/lib/appointments/availability";
import { resolveAvailabilityTarget } from "@/lib/appointments/resolve-target";
import { weeklyHoursPutSchema } from "@/lib/validations/availability.schema";
import { bookingDefaults } from "@/config/company/booking";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "view");
  if (!user) return response;

  const userUnitId = new URL(request.url).searchParams.get("userUnitId");
  const target = await resolveAvailabilityTarget(user, userUnitId);
  if (!target.user) {
    return jsonFail("FORBIDDEN", target.error ?? "Forbidden", 403);
  }

  const { rows, usingDefaults } = await loadWeeklyHours(target.user.id);
  const days = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ranges: rows
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime })),
  }));

  return jsonOk({
    userUnitId: target.user.unitId,
    usingDefaults,
    defaults: bookingDefaults.weeklyHours,
    days,
  });
});

export const PUT = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "edit");
  if (!user) return response;

  const raw = await request.json();
  const parsed = weeklyHoursPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }

  const target = await resolveAvailabilityTarget(user, parsed.data.userUnitId);
  if (!target.user) {
    return jsonFail("FORBIDDEN", target.error ?? "Forbidden", 403);
  }

  for (const day of parsed.data.days) {
    for (const range of day.ranges) {
      const a = timeToMinutes(range.startTime);
      const b = timeToMinutes(range.endTime);
      if (a == null || b == null || b <= a) {
        return jsonFail(
          "VALIDATION",
          `Invalid range on weekday ${day.weekday}: end must be after start`,
          400
        );
      }
    }
  }

  const flat = parsed.data.days.flatMap((day) =>
    day.ranges.map((r) => ({
      weekday: day.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
    }))
  );

  // Allocate IDs outside the interactive transaction (avoids 5s timeout).
  const toCreate =
    flat.length > 0
      ? await Promise.all(
          flat.map(async (row) => ({
            ...row,
            unitId: await nextUnitId("weeklyHours", user),
          }))
        )
      : [
          {
            ...CLOSED_WEEK_SENTINEL,
            unitId: await nextUnitId("weeklyHours", user),
          },
        ];

  await prisma.$transaction(
    async (tx) => {
      await tx.advocateWeeklyHours.deleteMany({
        where: { userId: target.user!.id },
      });
      await tx.advocateWeeklyHours.createMany({
        data: toCreate.map((row) => ({
          unitId: row.unitId,
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: target.user!.id,
          userUnitId: target.user!.unitId,
          weekday: row.weekday,
          startTime: row.startTime,
          endTime: row.endTime,
        })),
      });
    },
    { timeout: 15_000 }
  );

  const { rows, usingDefaults } = await loadWeeklyHours(target.user.id);
  const days = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ranges: rows
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime })),
  }));

  return jsonOk({
    userUnitId: target.user.unitId,
    usingDefaults,
    days,
  });
});
