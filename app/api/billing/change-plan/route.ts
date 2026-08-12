import { z } from "zod";
import { prisma } from "@meiyon/db";
import { apiHandler, jsonFail, jsonOk, parseBody } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";
import { getOfficeSubscription } from "@/lib/billing/access";

const schema = z.object({
  planCode: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const raw = await request.json();
  const parsed = parseBody(schema, raw);
  if (!parsed.success) return parsed.response;

  const ctx = await getOfficeSubscription(user.officeId);
  if (!ctx) {
    return jsonFail("NOT_FOUND", "No subscription found", 404);
  }

  const plan = await prisma.plan.findUnique({
    where: { code: parsed.data.planCode },
  });
  if (!plan) {
    return jsonFail("NOT_FOUND", "Plan not found", 404);
  }

  await prisma.subscription.update({
    where: { id: ctx.subscription.id },
    data: {
      planId: plan.id,
      planUnitId: plan.unitId,
      ...(parsed.data.billingCycle
        ? { billingCycle: parsed.data.billingCycle }
        : {}),
    },
  });

  return jsonOk({
    message: "Plan change scheduled. Complete checkout on Billing to activate.",
    planCode: plan.code,
  });
});
