import { prisma } from "@meiyon/db";
import type { Plan, Subscription } from "@prisma/client";

export async function getOfficeSubscription(officeId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { officeId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return null;

  const plan = await prisma.plan.findUnique({ where: { id: sub.planId } });
  return { subscription: sub, plan };
}

export type OfficeSubscriptionContext = {
  subscription: Subscription;
  plan: Plan;
  planCode: string;
};

export async function requireOfficeSubscription(
  officeId: string
): Promise<OfficeSubscriptionContext | null> {
  const ctx = await getOfficeSubscription(officeId);
  if (!ctx?.plan) return null;
  return {
    subscription: ctx.subscription,
    plan: ctx.plan,
    planCode: ctx.plan.code,
  };
}
