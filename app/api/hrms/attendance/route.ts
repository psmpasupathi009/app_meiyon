import { apiHandler, jsonFail, jsonOkList, parsePagination } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { requirePlanModule } from "@/lib/auth/plan-gate";
import { prisma } from "@meiyon/db";
import { hasPermission, requireModuleEnabled } from "@/lib/rbac";
import { toAttendanceSummary } from "@/features/hrms/server/serialize";
import {
  attendanceQueryScope,
  isInvalidAttendanceDateRange,
  parseAttendanceUserUnitIds,
} from "@/features/hrms/lib/attendance-scope";

export const GET = apiHandler(async (request) => {
  const modFail = requireModuleEnabled("hrms");
  if (modFail) return modFail;

  const { user, response } = await requireUser(request);
  if (!user) return response;
  const planFail = await requirePlanModule(user, "hrms");
  if (planFail) return planFail;

  const [canOwn, canManage] = await Promise.all([
    hasPermission(user, "hrms", "own_attendance"),
    hasPermission(user, "hrms", "manage_attendance"),
  ]);
  if (!canOwn && !canManage) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  const all =
    searchParams.get("all") === "1" || searchParams.get("all") === "true";
  const mine =
    searchParams.get("mine") === "1" || searchParams.get("mine") === "true";
  const userUnitIds = parseAttendanceUserUnitIds(searchParams);

  if (isInvalidAttendanceDateRange(from, to)) {
    return jsonFail("VALIDATION", "from must be on/before to", 400);
  }

  const scope = attendanceQueryScope({
    canManage,
    all,
    mine,
    userUnitIds,
    userId: user.id,
  });

  const where = {
    ...scope,
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { userUnitId: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.attendance.count({ where }),
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
    rows.map((r) => toAttendanceSummary(r, nameByUnit.get(r.userUnitId))),
    { page, pageSize, total }
  );
});
