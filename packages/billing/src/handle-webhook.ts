import { prisma } from "@meiyon/db";
import type { BillingCycle } from "@prisma/client";
import {
  createInvoiceRecord,
  addBillingPeriod,
  computeGstPaise,
} from "./create-invoice";
import { activateSubscriptionLocally } from "./create-subscription";

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    subscription?: { entity?: Record<string, unknown> };
    payment?: { entity?: Record<string, unknown> };
  };
};

function notesOf(entity: Record<string, unknown> | undefined) {
  return (entity?.notes as Record<string, string> | undefined) ?? {};
}

export async function handleRazorpayWebhook(
  eventId: string,
  payload: RazorpayWebhookPayload
): Promise<void> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { razorpayEventId: eventId },
  });
  if (existing) return;

  await prisma.webhookEvent.create({
    data: { razorpayEventId: eventId, payload: payload as object },
  });

  const event = payload.event;
  const subEntity = payload.payload?.subscription?.entity;
  const payEntity = payload.payload?.payment?.entity;

  if (event === "subscription.activated" && subEntity) {
    const notes = notesOf(subEntity);
    const unitId = notes.subscriptionUnitId;
    if (!unitId) return;
    const cycle = (notes.billingCycle as BillingCycle) ?? "monthly";
    await activateSubscriptionLocally(unitId, cycle);
    return;
  }

  if (event === "subscription.charged" && subEntity) {
    const notes = notesOf(subEntity);
    const unitId = notes.subscriptionUnitId;
    if (!unitId) return;

    const sub = await prisma.subscription.findUnique({ where: { unitId } });
    if (!sub) return;

    const plan = await prisma.plan.findUnique({ where: { id: sub.planId } });
    if (!plan) return;

    const amountPaise =
      sub.billingCycle === "yearly"
        ? plan.yearlyPricePaise
        : plan.monthlyPricePaise;

    const paymentId =
      (payEntity?.id as string | undefined) ??
      (subEntity.id as string | undefined);

    await createInvoiceRecord({
      officeId: sub.officeId,
      officeUnitId: sub.officeUnitId,
      subscriptionId: sub.id,
      amountPaise,
      taxPaise: computeGstPaise(amountPaise),
      razorpayPaymentId: paymentId,
      status: "paid",
    });

    const now = new Date();
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: addBillingPeriod(now, sub.billingCycle),
      },
    });
    return;
  }

  if (
    (event === "payment.failed" || event === "subscription.halted") &&
    subEntity
  ) {
    const notes = notesOf(subEntity);
    const unitId = notes.subscriptionUnitId;
    if (!unitId) return;
    await prisma.subscription.update({
      where: { unitId },
      data: { status: "past_due" },
    });
    return;
  }

  if (event === "subscription.cancelled" && subEntity) {
    const notes = notesOf(subEntity);
    const unitId = notes.subscriptionUnitId;
    if (!unitId) return;
    await prisma.subscription.update({
      where: { unitId },
      data: { status: "cancelled" },
    });
  }
}
