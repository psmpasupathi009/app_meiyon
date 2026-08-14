import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit } from "@/lib/audit";
import { decideLeaveSchema } from "@/lib/validations/hrms.schema";
import { toLeaveSummary } from "@/features/hrms/server/serialize";
import { istDateKey } from "@/lib/utils/ist";
import { notifyUser, scheduleNotify } from "@/lib/notifications/notify";
import { requirePlanModule } from "@/lib/auth/plan-gate";

export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "hrms", "approve_leave");
  if (!user) return response;

  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const { unitId } = (await context.params) ?? {};
  const leave = unitId
    ? await prisma.leaveRequest.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!leave) return jsonFail("NOT_FOUND", "Leave request not found", 404);

  if (leave.status !== "pending") {
    return jsonFail("CONFLICT", "This leave request has already been decided", 409);
  }
  if (leave.userId === user.id) {
    return jsonFail("FORBIDDEN", "You cannot approve or reject your own leave", 403);
  }

  const raw = await request.json();
  const parsed = decideLeaveSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  if (input.decision === "rejected" && !(input.rejectReason?.trim())) {
    return jsonFail("VALIDATION", "A reason is required to reject leave", 400);
  }

  if (input.decision === "approved") {
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: leave.userId,
        status: "approved",
        id: { not: leave.id },
        fromDate: { lte: leave.toDate },
        toDate: { gte: leave.fromDate },
      },
      select: { unitId: true, fromDate: true, toDate: true },
    });
    if (overlap) {
      return jsonFail(
        "CONFLICT",
        `Overlaps existing approved leave (${overlap.fromDate} → ${overlap.toDate})`,
        409
      );
    }
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: {
      status: input.decision,
      approvedById: user.id,
      approvedAt: new Date(),
      rejectReason:
        input.decision === "rejected" ? input.rejectReason?.trim() : undefined,
    },
  });

  // If leave covers today and they already checked in, close the open attendance row.
  let autoCheckedOutAttendanceUnitId: string | null = null;
  if (input.decision === "approved") {
    const today = istDateKey();
    if (leave.fromDate <= today && leave.toDate >= today) {
      const open = await prisma.attendance.findFirst({
        where: {
          userId: leave.userId,
          date: today,
          checkInAt: { not: null },
          checkOutAt: null,
        },
      });
      if (open) {
        await prisma.attendance.update({
          where: { id: open.id },
          data: {
            checkOutAt: new Date(),
            notes: open.notes
              ? `${open.notes} · auto check-out (leave approved)`
              : "Auto check-out (leave approved)",
          },
        });
        autoCheckedOutAttendanceUnitId = open.unitId;
      }
    }
  }

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: `leave.${input.decision}`,
    entity: "LeaveRequest",
    entityUnitId: updated.unitId,
    meta: {
      before: {
        status: leave.status,
        rejectReason: leave.rejectReason,
      },
      after: {
        status: updated.status,
        rejectReason: updated.rejectReason,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
      },
      changes: {
        status: { from: leave.status, to: updated.status },
        ...(leave.rejectReason !== updated.rejectReason
          ? {
              rejectReason: {
                from: leave.rejectReason,
                to: updated.rejectReason,
              },
            }
          : {}),
      },
      ...(autoCheckedOutAttendanceUnitId
        ? { autoCheckedOutAttendanceUnitId }
        : {}),
    },
  });

  scheduleNotify(async () => {
    const label = input.decision === "approved" ? "approved" : "rejected";
    await notifyUser({
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      userId: leave.userId,
      userUnitId: leave.userUnitId,
      type: "leave_decided",
      title: `Leave ${label}`,
      body: `${leave.fromDate} → ${leave.toDate}`,
      href: "/hrms?section=leave",
      meta: { leaveUnitId: updated.unitId, decision: input.decision },
    });
  });

  return jsonOk({ leave: toLeaveSummary(updated) });
});
