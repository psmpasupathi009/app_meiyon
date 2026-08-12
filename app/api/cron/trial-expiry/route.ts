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

export const POST = apiHandler(async (request) => {
  if (!authorizeCron(request)) {
    return jsonOk({ skipped: true, reason: "unauthorized" });
  }

  const now = new Date();
  const expired = await prisma.subscription.findMany({
    where: {
      status: "trialing",
      trialEndsAt: { lt: now },
    },
  });

  let updated = 0;
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "past_due" },
    });
    updated++;
  }

  return jsonOk({ updated, action: "trial_to_past_due" });
});

export const GET = POST;
