import { prisma } from "@meiyon/db";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { normalizeMobile } from "@/lib/auth/mobile";
import { classifyBillingAccess } from "@/lib/billing/access";
import { z } from "zod";

const schema = z.object({ mobile: z.string().min(10).max(14) });

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonFail("VALIDATION", "Enter a valid 10-digit mobile number", 400);
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!mobile) {
    return jsonFail("VALIDATION", "Enter a valid Indian mobile number", 400);
  }

  const users = await prisma.user.findMany({
    where: { mobile, isActive: true },
  });

  if (users.length === 0) {
    return jsonOk({
      status: "not_found" as const,
      message: "This number is not registered. Contact your office admin.",
    });
  }

  const offices = await Promise.all(
    users.map(async (u) => {
      const office = await prisma.office.findUnique({
        where: { id: u.officeId },
        select: { unitId: true, name: true, displayName: true, status: true },
      });
      const sub = await prisma.subscription.findFirst({
        where: { officeId: u.officeId },
        select: { status: true },
      });
      const isAdmin = u.roles.includes("admin") || u.roles.includes("sub_admin");
      const gate = classifyBillingAccess({
        officeStatus: office?.status,
        subStatus: sub?.status,
        roles: u.roles,
      });
      return {
        officeUnitId: u.officeUnitId,
        officeName: office?.displayName ?? office?.name ?? "Office",
        officeStatus: office?.status,
        subscriptionStatus: sub?.status,
        hasPin: Boolean(u.pinHash),
        gate,
        isAdmin,
      };
    })
  );

  const reachable = offices.filter((o) => o.gate !== "blocked");

  if (reachable.length === 0) {
    return jsonOk({
      status: "suspended" as const,
      message: "Your office access is suspended. Contact support.",
    });
  }

  if (reachable.length === 1) {
    const o = reachable[0];
    if (o.hasPin) {
      return jsonOk({
        status: "pin" as const,
        officeUnitId: o.officeUnitId,
      });
    }
    const pendingSetup = await prisma.otpSession.findFirst({
      where: {
        mobile,
        purpose: "setup",
        verified: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    return jsonOk({
      status: "otp_required" as const,
      officeUnitId: o.officeUnitId,
      otpPending: Boolean(pendingSetup),
    });
  }

  return jsonOk({
    status: "office_picker" as const,
    offices: reachable.map(({ hasPin, ...o }) => ({
      ...o,
      requiresPin: hasPin,
    })),
  });
});
