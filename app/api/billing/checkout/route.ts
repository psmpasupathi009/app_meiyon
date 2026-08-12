import { z } from "zod";
import { prisma } from "@meiyon/db";
import { createRazorpayCheckout } from "@meiyon/billing";
import { apiHandler, jsonFail, jsonOk, parseBody } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";
import { getOfficeSubscription } from "@/lib/billing/access";

const schema = z.object({
  planCode: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const raw = await request.json();
  const parsed = parseBody(schema, raw);
  if (!parsed.success) return parsed.response;

  const ctx = await getOfficeSubscription(user.officeId);
  if (!ctx) {
    return jsonFail("NOT_FOUND", "No subscription found for this office", 404);
  }

  const plan = await prisma.plan.findUnique({
    where: { code: parsed.data.planCode },
  });
  if (!plan?.isActive) {
    return jsonFail("NOT_FOUND", "Plan not found", 404);
  }

  try {
    const checkout = await createRazorpayCheckout({
      subscription: ctx.subscription,
      plan,
      billingCycle: parsed.data.billingCycle,
      customerName: user.name ?? "Office Admin",
      customerMobile: user.mobile,
      customerEmail: user.email,
    });

    return jsonOk(checkout);
  } catch (error) {
    console.error("[billing/checkout]", error);
    return jsonFail(
      "CHECKOUT_FAILED",
      error instanceof Error ? error.message : "Could not start checkout",
      502
    );
  }
});
