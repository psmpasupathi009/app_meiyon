import type { User, UserRole } from "@prisma/client";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import { prisma } from "@meiyon/db";

/** Resolve which advocate user hours/blocks apply to. */
export async function resolveAvailabilityTarget(
  actor: Pick<User, "id" | "unitId" | "roles" | "mobile" | "name">,
  requestedUnitId?: string | null
): Promise<{
  user: Pick<User, "id" | "unitId" | "mobile" | "name"> | null;
  error?: string;
}> {
  const requested = requestedUnitId?.trim();
  if (!requested || requested === actor.unitId) {
    return {
      user: {
        id: actor.id,
        unitId: actor.unitId,
        mobile: actor.mobile,
        name: actor.name ?? null,
      },
    };
  }

  if (!canBookForAnyAdvocate(actor.roles as UserRole[])) {
    return { user: null, error: "You can only manage your own availability" };
  }

  const target = await prisma.user.findFirst({
    where: {
      unitId: requested,
      isActive: true,
      roles: { has: "advocate" },
    },
    select: { id: true, unitId: true, mobile: true, name: true },
  });
  if (!target) return { user: null, error: "Advocate not found" };
  return { user: target };
}
