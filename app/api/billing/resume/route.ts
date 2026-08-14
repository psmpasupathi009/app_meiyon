import { resumeSubscriptionCancel } from "@meiyon/billing";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";
import { getOfficeSubscription } from "@/lib/billing/access";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const ctx = await getOfficeSubscription(user.officeId);
  if (!ctx) {
    return jsonFail("NOT_FOUND", "No subscription found", 404);
  }

  await resumeSubscriptionCancel(ctx.subscription.unitId);
  return jsonOk({ message: "Cancellation withdrawn. Access continues." });
});
