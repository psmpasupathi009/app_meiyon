import { cancelSubscriptionAtPeriodEnd } from "@meiyon/billing";
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

  try {
    await cancelSubscriptionAtPeriodEnd(ctx.subscription.unitId);
    return jsonOk({ message: "Subscription will cancel at period end." });
  } catch (error) {
    console.error("[billing/cancel]", error);
    return jsonFail(
      "CANCEL_FAILED",
      error instanceof Error ? error.message : "Could not cancel subscription",
      502
    );
  }
});
