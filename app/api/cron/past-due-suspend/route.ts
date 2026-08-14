import { apiHandler, jsonOk } from "@/lib/api/response";
import { prisma } from "@meiyon/db";
import { authorizeCron } from "@/lib/cron-auth";

const GRACE_DAYS = 7;

export const POST = apiHandler(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const overdue = await prisma.subscription.findMany({
    where: {
      status: "past_due",
      OR: [
        { trialEndsAt: { lt: cutoff } },
        { trialEndsAt: null, currentPeriodEnd: { lt: cutoff } },
        { trialEndsAt: null, currentPeriodEnd: null, updatedAt: { lt: cutoff } },
      ],
    },
  });

  let suspended = 0;
  for (const sub of overdue) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "suspended" },
    });
    await prisma.office.update({
      where: { id: sub.officeId },
      data: { status: "suspended" },
    });
    suspended++;
  }

  return jsonOk({ suspended, action: "past_due_to_suspended" });
});

export const GET = POST;
