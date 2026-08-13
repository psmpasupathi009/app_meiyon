import { prisma } from "@meiyon/db";
import { jsonFail, jsonOk } from "@/lib/api/response";
import { normalizeMobile } from "@/lib/auth/mobile";
import { z } from "zod";

const schema = z.object({ mobile: z.string().min(10).max(14) });

export async function POST(request: Request) {
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
      return {
        officeUnitId: u.officeUnitId,
        officeName: office?.displayName ?? office?.name ?? "Office",
        officeStatus: office?.status,
        subscriptionStatus: sub?.status,
        hasPin: Boolean(u.pinHash),
      };
    })
  );

  const activeOffices = offices.filter(
    (o) =>
      o.officeStatus === "active" &&
      o.subscriptionStatus !== "suspended" &&
      o.subscriptionStatus !== "expired" &&
      o.subscriptionStatus !== "cancelled"
  );

  if (activeOffices.length === 0) {
    return jsonOk({
      status: "suspended" as const,
      message: "Your office access is suspended. Contact support.",
    });
  }

  if (activeOffices.length === 1) {
    const o = activeOffices[0];
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
    offices: activeOffices.map(({ hasPin, ...o }) => ({
      ...o,
      requiresPin: hasPin,
    })),
  });
}
