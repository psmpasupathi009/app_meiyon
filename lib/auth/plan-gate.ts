import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { planHasModule, modulePlanKey } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { requireOfficeSubscription } from "@/lib/billing/access";
import { jsonFail } from "@/lib/api/response";

export async function getPlanCodeForUser(user: User): Promise<string | null> {
  const ctx = await requireOfficeSubscription(user.officeId);
  return ctx?.planCode ?? null;
}

export async function officeHasPlanModule(
  officeUnitId: string,
  module: string
): Promise<boolean> {
  const office = await prisma.office.findUnique({
    where: { unitId: officeUnitId },
    select: { id: true },
  });
  if (!office) return false;
  const ctx = await requireOfficeSubscription(office.id);
  if (!ctx) return false;
  return planHasModule(ctx.planCode, modulePlanKey(module));
}

export async function userHasPlanModule(
  user: User,
  module: string
): Promise<boolean> {
  const planCode = await getPlanCodeForUser(user);
  if (!planCode) return false;
  return planHasModule(planCode, modulePlanKey(module));
}

export async function requirePlanModule(
  user: User,
  module: string
): Promise<NextResponse | null> {
  const allowed = await userHasPlanModule(user, module);
  if (!allowed) {
    return jsonFail(
      "PLAN_REQUIRED",
      `This feature requires a higher plan. Upgrade on Billing.`,
      403,
      { module }
    );
  }
  return null;
}

export async function checkSeatLimit(officeId: string): Promise<{
  allowed: boolean;
  activeSeats: number;
  seatLimit: number;
}> {
  const ctx = await requireOfficeSubscription(officeId);
  if (!ctx) {
    return { allowed: false, activeSeats: 0, seatLimit: 0 };
  }

  const { prisma } = await import("@meiyon/db");
  const activeSeats = await prisma.user.count({
    where: {
      officeId,
      isActive: true,
      NOT: { roles: { equals: ["client"] } },
    },
  });

  return {
    allowed: activeSeats < ctx.plan.seatLimit,
    activeSeats,
    seatLimit: ctx.plan.seatLimit,
  };
}
