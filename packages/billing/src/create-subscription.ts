import type { BillingCycle, Plan, Subscription } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { razorpayApi } from "./razorpay-client";
import { addBillingPeriod } from "./create-invoice";

async function ensureRazorpayPlan(
  plan: Plan,
  cycle: BillingCycle
): Promise<string> {
  const field =
    cycle === "yearly" ? "razorpayPlanIdYearly" : "razorpayPlanIdMonthly";
  const existing = plan[field as keyof Plan] as string | null | undefined;
  if (existing) return existing;

  const amountPaise =
    cycle === "yearly" ? plan.yearlyPricePaise : plan.monthlyPricePaise;
  const period = cycle === "yearly" ? "yearly" : "monthly";

  const created = await razorpayApi.plans.create({
    period,
    interval: 1,
    item: {
      name: `MEIYON ${plan.name} (${cycle})`,
      amount: amountPaise,
      currency: "INR",
      description: `${plan.name} plan — ${cycle} billing`,
    },
  });

  await prisma.plan.update({
    where: { id: plan.id },
    data: { [field]: created.id },
  });

  return created.id;
}

async function ensureRazorpayCustomer(input: {
  subscription: Subscription;
  name: string;
  mobile: string;
  email?: string | null;
}): Promise<string> {
  if (input.subscription.razorpayCustomerId) {
    return input.subscription.razorpayCustomerId;
  }

  const customer = await razorpayApi.customers.create({
    name: input.name,
    contact: input.mobile.replace(/\D/g, "").slice(-10),
    email: input.email ?? undefined,
    notes: { officeUnitId: input.subscription.officeUnitId },
  });

  await prisma.subscription.update({
    where: { id: input.subscription.id },
    data: { razorpayCustomerId: customer.id },
  });

  return customer.id;
}

export type CheckoutInput = {
  subscription: Subscription;
  plan: Plan;
  billingCycle: BillingCycle;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | null;
};

export type CheckoutResult = {
  subscriptionId: string;
  razorpaySubscriptionId: string;
  keyId: string;
  planName: string;
  amountPaise: number;
};

export async function createRazorpayCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const planId = await ensureRazorpayPlan(input.plan, input.billingCycle);
  const customerId = await ensureRazorpayCustomer({
    subscription: input.subscription,
    name: input.customerName,
    mobile: input.customerMobile,
    email: input.customerEmail,
  });

  const totalCount = input.billingCycle === "yearly" ? 10 : 120;

  const sub = await razorpayApi.subscriptions.create({
    plan_id: planId,
    customer_id: customerId,
    total_count: totalCount,
    quantity: 1,
    customer_notify: 1,
    notes: {
      officeUnitId: input.subscription.officeUnitId,
      subscriptionUnitId: input.subscription.unitId,
      planCode: input.plan.code,
      billingCycle: input.billingCycle,
    },
  });

  await prisma.subscription.update({
    where: { id: input.subscription.id },
    data: {
      razorpaySubscriptionId: sub.id,
      billingCycle: input.billingCycle,
      planId: input.plan.id,
      planUnitId: input.plan.unitId,
    },
  });

  const amountPaise =
    input.billingCycle === "yearly"
      ? input.plan.yearlyPricePaise
      : input.plan.monthlyPricePaise;

  return {
    subscriptionId: input.subscription.unitId,
    razorpaySubscriptionId: sub.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
    planName: input.plan.name,
    amountPaise,
  };
}

export async function activateSubscriptionLocally(
  subscriptionUnitId: string,
  billingCycle: BillingCycle
) {
  const now = new Date();
  const periodEnd = addBillingPeriod(now, billingCycle);
  return prisma.subscription.update({
    where: { unitId: subscriptionUnitId },
    data: {
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    },
  });
}

export async function cancelSubscriptionAtPeriodEnd(subscriptionUnitId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { unitId: subscriptionUnitId },
  });
  if (!sub?.razorpaySubscriptionId) {
    return prisma.subscription.update({
      where: { unitId: subscriptionUnitId },
      data: { status: "cancelled" },
    });
  }

  await razorpayApi.subscriptions.cancel(sub.razorpaySubscriptionId, {
    cancel_at_cycle_end: 1,
  });

  return prisma.subscription.update({
    where: { unitId: subscriptionUnitId },
    data: { status: "cancelled" },
  });
}
