import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { buildDashboardSummary } from "@/features/home/server/dashboard-summary";
import { isClientOnlyUser } from "@/lib/auth/client-portal";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "dashboard", "view");
  if (!user) return response;

  // Office-wide dashboard is staff-only; clients use ClientHomeOverview.
  if (isClientOnlyUser(user.roles)) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const summary = await buildDashboardSummary(user);
  return jsonOk({ summary });
});
