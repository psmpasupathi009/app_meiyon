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

export type BillingGate = "full" | "past_due" | "paywall" | "blocked";

export function classifyBillingAccess(input: {
  officeStatus?: string | null;
  subStatus?: string | null;
  roles: string[];
}): BillingGate {
  const isAdmin =
    input.roles.includes("admin") || input.roles.includes("sub_admin");
  const office = input.officeStatus ?? "";
  const sub = input.subStatus ?? null;

  if (office === "closed" || office === "draft") return "blocked";

  if (sub === "past_due") {
    if (office === "suspended") return isAdmin ? "paywall" : "blocked";
    return "past_due";
  }

  if (
    office === "suspended" ||
    sub === "suspended" ||
    sub === "expired" ||
    sub === "cancelled"
  ) {
    return isAdmin ? "paywall" : "blocked";
  }

  return "full";
}

export function isBillingApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/billing") || pathname.startsWith("/api/auth")
  );
}

export async function gateForUser(user: {
  officeId: string;
  roles: string[];
}): Promise<BillingGate> {
  const office = await prisma.office.findUnique({
    where: { id: user.officeId },
    select: { status: true },
  });
  const sub = await prisma.subscription.findFirst({
    where: { officeId: user.officeId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  return classifyBillingAccess({
    officeStatus: office?.status,
    subStatus: sub?.status,
    roles: user.roles,
  });
}
