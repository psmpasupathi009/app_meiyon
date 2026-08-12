import { apiHandler, jsonOk } from "@/lib/api/response";
import { prisma } from "@meiyon/db";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return header === secret;
}

const GRACE_DAYS = 7;

export const POST = apiHandler(async (request) => {
  if (!authorizeCron(request)) {
    return jsonOk({ skipped: true, reason: "unauthorized" });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const overdue = await prisma.subscription.findMany({
    where: {
      status: "past_due",
      updatedAt: { lt: cutoff },
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
