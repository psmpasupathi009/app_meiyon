import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm, requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { hasPermission, requireModuleEnabled } from "@/lib/rbac";
import { requirePlanModule } from "@/lib/auth/plan-gate";
import { applyLeaveSchema } from "@/lib/validations/hrms.schema";
import { toLeaveSummary } from "@/features/hrms/server/serialize";
import {
  findUsersWithPermission,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";
import type { LeaveStatus } from "@prisma/client";

export const GET = apiHandler(async (request) => {
  const modFail = requireModuleEnabled("hrms");
  if (modFail) return modFail;

  const { user, response } = await requireUser(request);
  if (!user) return response;

  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const canOwn = await hasPermission(user, "hrms", "own_leave");
  const canApprove = await hasPermission(user, "hrms", "approve_leave");
  if (!canOwn && !canApprove) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const userUnitId = searchParams.get("userUnitId")?.trim();
  const status = searchParams.get("status")?.trim();
  const mine = searchParams.get("mine") === "1" || searchParams.get("mine") === "true";

  const allowedStatuses = new Set<LeaveStatus>([
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ]);

  let statusFilter: LeaveStatus | { in: LeaveStatus[] } | undefined;
  if (status === "decided") {
    statusFilter = { in: ["approved", "rejected"] };
  } else if (status && allowedStatuses.has(status as LeaveStatus)) {
    statusFilter = status as LeaveStatus;
  }

  const where = {
    ...(mine || !canApprove
      ? { userId: user.id }
      : userUnitId
        ? { userUnitId }
        : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const unitIds = Array.from(new Set(rows.map((r) => r.userUnitId)));
  const users =
    unitIds.length > 0
      ? await prisma.user.findMany({
          where: { unitId: { in: unitIds } },
          select: { unitId: true, name: true },
        })
      : [];
  const nameByUnit = new Map(users.map((u) => [u.unitId, u.name]));

  return jsonOkList(
    rows.map((r) => toLeaveSummary(r, nameByUnit.get(r.userUnitId))),
    { page, pageSize, total }
  );
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "hrms", "own_leave");
  if (!user) return response;

  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const raw = await request.json();
  const parsed = applyLeaveSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId: user.id,
      status: { in: ["pending", "approved"] },
      fromDate: { lte: input.toDate },
      toDate: { gte: input.fromDate },
    },
    select: { unitId: true, fromDate: true, toDate: true, status: true },
  });
  if (overlap) {
    return jsonFail(
      "CONFLICT",
      `Overlaps existing ${overlap.status} leave (${overlap.fromDate} → ${overlap.toDate})`,
      409
    );
  }

  const unitId = await nextUnitId("leave", user);
  const created = await prisma.leaveRequest.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      userId: user.id,
      userUnitId: user.unitId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason || undefined,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "leave.apply",
    entity: "LeaveRequest",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "fromDate",
        "toDate",
        "reason",
        "status",
        "userUnitId",
      ] as const),
    },
  });

  scheduleNotify(async () => {
    const approvers = await findUsersWithPermission(user.officeId, "hrms", "approve_leave");
    await notifyUsers(
      approvers
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "leave_request",
          title: `Leave request from ${user.name ?? user.unitId}`,
          body: `${created.fromDate} → ${created.toDate}`,
          href: "/hrms?section=leave",
          meta: { leaveUnitId: created.unitId },
        }))
    );
  });

  return jsonOk({ leave: toLeaveSummary(created) }, 201);
});
