import { apiHandler } from "@/lib/api/response";
import { jsonOk } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";
import { getOfficeSubscription } from "@/lib/billing/access";
import { getOfficeUsage } from "@meiyon/billing";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const ctx = await getOfficeSubscription(user.officeId);
  if (!ctx) {
    return jsonOk({ subscription: null, plan: null, usage: null });
  }
  if (!ctx.plan) {
    return jsonOk({ subscription: ctx.subscription, plan: null, usage: null });
  }

  const usage = await getOfficeUsage(user.officeId);

  return jsonOk({
    subscription: {
      unitId: ctx.subscription.unitId,
      status: ctx.subscription.status,
      billingCycle: ctx.subscription.billingCycle,
      currentPeriodStart: ctx.subscription.currentPeriodStart,
      currentPeriodEnd: ctx.subscription.currentPeriodEnd,
      trialEndsAt: ctx.subscription.trialEndsAt,
      cancelAtPeriodEnd: ctx.subscription.cancelAtPeriodEnd,
    },
    plan: {
      code: ctx.plan.code,
      name: ctx.plan.name,
      monthlyPricePaise: ctx.plan.monthlyPricePaise,
      yearlyPricePaise: ctx.plan.yearlyPricePaise,
      seatLimit: ctx.plan.seatLimit,
      smsLimit: ctx.plan.smsLimit,
      storageBytes: ctx.plan.storageBytes.toString(),
    },
    usage: {
      ...usage,
      storageBytes: usage.storageBytes.toString(),
    },
  });
});
