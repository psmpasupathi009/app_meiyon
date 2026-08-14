import { apiHandler, jsonOk } from "@/lib/api/response";
import { prisma } from "@meiyon/db";
import { authorizeCron } from "@/lib/cron-auth";

export const POST = apiHandler(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const now = new Date();
  const expired = await prisma.subscription.findMany({
    where: {
      status: "trialing",
      trialEndsAt: { lt: now },
    },
  });

  let trialToPastDue = 0;
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "past_due" },
    });
    trialToPastDue++;
  }

  const ending = await prisma.subscription.findMany({
    where: {
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lt: now },
    },
  });

  let cancelledAtPeriodEnd = 0;
  for (const sub of ending) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "cancelled", cancelAtPeriodEnd: false },
    });
    cancelledAtPeriodEnd++;
  }

  return jsonOk({
    trialToPastDue,
    cancelledAtPeriodEnd,
    action: "trial_expiry_and_period_end_cancel",
  });
});

export const GET = POST;
