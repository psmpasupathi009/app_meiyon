import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { istDateKey } from "@/lib/utils/ist";
import { checkInOutSchema } from "@/lib/validations/hrms.schema";
import { toAttendanceSummary } from "@/features/hrms/server/serialize";
import { findOfficeHolidayForDate } from "@/features/hrms/server/office-holiday";
import { requirePlanModule } from "@/lib/auth/plan-gate";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "hrms", "own_attendance");
  if (!user) return response;

  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const raw = await request.json().catch(() => ({}));
  const parsed = checkInOutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }

  const today = istDateKey();
  const { latitude, longitude, accuracy, notes } = parsed.data;

  const holiday = await findOfficeHolidayForDate(today);
  if (holiday) {
    return jsonFail(
      "CONFLICT",
      `Office closed today (${holiday.title}) — check-in is not needed`,
      409
    );
  }

  const onLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: user.id,
      status: "approved",
      fromDate: { lte: today },
      toDate: { gte: today },
    },
    select: { unitId: true },
  });
  if (onLeave) {
    return jsonFail(
      "CONFLICT",
      "You are on approved leave today — check-in is not needed",
      409
    );
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      officeId_userId_date: {
        officeId: user.officeId,
        userId: user.id,
        date: today,
      },
    },
  });

  if (existing?.checkInAt) {
    return jsonFail("CONFLICT", "Already checked in today", 409);
  }

  const geo = {
    checkInLat: latitude,
    checkInLng: longitude,
    checkInAccuracy: accuracy ?? null,
  };

  let record;
  try {
    record = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkInAt: new Date(),
            notes: notes || existing.notes,
            ...geo,
          },
        })
      : await prisma.attendance.create({
          data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
            unitId: await nextUnitId("attendance", user),
            userId: user.id,
            userUnitId: user.unitId,
            date: today,
            checkInAt: new Date(),
            notes: notes || undefined,
            ...geo,
          },
        });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code === "P2002") {
      return jsonFail("CONFLICT", "Already checked in today", 409);
    }
    throw err;
  }

  return jsonOk({ attendance: toAttendanceSummary(record) });
});
