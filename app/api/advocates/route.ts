import { apiHandler, jsonFail, jsonOkList, parsePagination } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { displayMobile } from "@/lib/auth/mobile";
import { userPhotoUrl } from "@/lib/auth/user-photo";
import { personDisplayName } from "@/shared/lib/person";
import { containsInsensitive } from "@/lib/db/search";
import { parseDefaultCourts } from "@/lib/hearings/court-key";

/**
 * Advocates list for case assignment and appointment booking.
 */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const canCases =
    isModuleEnabled("cases") &&
    (await hasPermission(user, "cases", "view"));
  const canAppt =
    isModuleEnabled("appointments") &&
    ((await hasPermission(user, "appointments", "view")) ||
      (await hasPermission(user, "appointments", "create")));
  if (!canCases && !canAppt) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const q = searchParams.get("q")?.trim() ?? "";
  const digits = q.replace(/\D/g, "");

  const where = {
    isActive: true,
    roles: { has: "advocate" as const },
    ...(q
      ? {
          OR: [
            { name: containsInsensitive(q) },
            ...(digits ? [{ mobile: { contains: digits } }] : []),
            { unitId: containsInsensitive(q) },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      select: {
        unitId: true,
        name: true,
        mobile: true,
        designation: true,
        photoKey: true,
        defaultCourts: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOkList(
    rows.map((r) => {
      const mobile = displayMobile(r.mobile);
      return {
        unitId: r.unitId,
        name: r.name,
        displayName: personDisplayName({
          name: r.name,
          mobile,
          unitId: r.unitId,
        }),
        mobile,
        designation: r.designation,
        photoUrl: userPhotoUrl(r.unitId, Boolean(r.photoKey)),
        defaultCourts: parseDefaultCourts(r.defaultCourts),
      };
    }),
    { page, pageSize, total }
  );
});
