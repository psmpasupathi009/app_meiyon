import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { istDateKey } from "@/lib/utils/ist";
import { checkInOutSchema } from "@/lib/validations/hrms.schema";
import { toAttendanceSummary } from "@/features/hrms/server/serialize";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "hrms", "own_attendance");
  if (!user) return response;

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
  const existing = await prisma.attendance.findUnique({
    where: {
      officeId_userId_date: {
        officeId: user.officeId,
        userId: user.id,
        date: today,
      },
    },
  });

  if (!existing?.checkInAt) {
    return jsonFail("CONFLICT", "Check in before checking out", 409);
  }
  if (existing.checkOutAt) {
    return jsonFail("CONFLICT", "Already checked out today", 409);
  }

  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOutAt: new Date(),
      notes: notes || existing.notes,
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutAccuracy: accuracy ?? null,
    },
  });

  return jsonOk({ attendance: toAttendanceSummary(record) });
});
