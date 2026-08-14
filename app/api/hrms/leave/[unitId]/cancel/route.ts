import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm, requireUser } from "@/lib/api/guard";
import type { Prisma } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { toLeaveSummary } from "@/features/hrms/server/serialize";
import { istDateKey } from "@/lib/utils/ist";
import { requirePlanModule } from "@/lib/auth/plan-gate";

/**
 * Cancel a leave request:
 * - Owner may cancel pending leave
 * - Owner or leave approver may cancel approved leave that has not fully ended
 */
export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const { unitId } = (await context.params) ?? {};
  const leave = unitId
    ? await prisma.leaveRequest.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!leave) return jsonFail("NOT_FOUND", "Leave request not found", 404);

  const isOwner = leave.userId === user.id;
  const today = istDateKey();

  if (leave.status === "pending") {
    if (!isOwner) {
      return jsonFail(
        "FORBIDDEN",
        "You can only cancel your own leave request",
        403
      );
    }
    const own = await requirePerm(request, "hrms", "own_leave");
    if (!own.user) return own.response;
  } else if (leave.status === "approved") {
    if (leave.toDate < today) {
      return jsonFail(
        "CONFLICT",
        "Approved leave that has already ended cannot be cancelled",
        409
      );
    }
    if (!isOwner) {
      const approve = await requirePerm(request, "hrms", "approve_leave");
      if (!approve.user) return approve.response;
    } else {
      const own = await requirePerm(request, "hrms", "own_leave");
      if (!own.user) return own.response;
    }
  } else {
    return jsonFail(
      "CONFLICT",
      "Only pending or approved leave can be cancelled",
      409
    );
  }

  const before = pickAuditFields(leave as Record<string, unknown>, ["status"] as const);

  const data = {
    status: "cancelled",
  } as unknown as Prisma.LeaveRequestUpdateInput;

  const updated = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data,
  });

  const after = pickAuditFields(updated as Record<string, unknown>, ["status"] as const);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "leave.cancel",
    entity: "LeaveRequest",
    entityUnitId: leave.unitId,
    meta: {
      before,
      after,
      changes: diffAudit(before, after),
      wasApproved: leave.status === "approved",
    },
  });

  const { scheduleNotify, notifyUsers, findUsersWithPermission } = await import(
    "@/lib/notifications/notify"
  );

  if (leave.status === "approved") {
    scheduleNotify(async () => {
      const approvers = await findUsersWithPermission(user.officeId, "hrms", "approve_leave");
      await notifyUsers(
        approvers
          .filter((a) => a.id !== user.id)
          .map((a) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: a.id,
            userUnitId: a.unitId,
            type: "leave_cancelled",
            title: "Approved leave cancelled",
            body: `${leave.fromDate} → ${leave.toDate}`,
            href: "/hrms?section=leave",
            meta: { leaveUnitId: leave.unitId },
          }))
      );
    });
  } else {
    scheduleNotify(async () => {
      const approvers = await findUsersWithPermission(user.officeId, "hrms", "approve_leave");
      await notifyUsers(
        approvers
          .filter((a) => a.id !== user.id)
          .map((a) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: a.id,
            userUnitId: a.unitId,
            type: "leave_cancelled",
            title: "Leave request cancelled",
            body: `${leave.fromDate} → ${leave.toDate}`,
            href: "/hrms?section=leave",
            meta: { leaveUnitId: leave.unitId },
          }))
      );
    });
  }

  return jsonOk({
    cancelled: true,
    unitId: leave.unitId,
    leave: toLeaveSummary(updated),
  });
});
