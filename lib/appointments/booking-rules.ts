import type { UserRole } from "@prisma/client";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { isClientOnlyUser } from "@/lib/auth/client-portal";

/** Admin, sub-admin, and office staff can book for any advocate. Clients also pick an advocate. */
export function canBookForAnyAdvocate(roles: UserRole[]): boolean {
  return roles.some(
    (r) =>
      r === "admin" ||
      r === "sub_admin" ||
      r === "staff" ||
      r === "client"
  );
}

/** Office roles that can browse any advocate’s diary (not clients). */
export function canViewAnyAdvocateDiary(roles: UserRole[]): boolean {
  if (isClientOnlyUser(roles)) return false;
  return roles.some(
    (r) => r === "admin" || r === "sub_admin" || r === "staff"
  );
}

/**
 * Resolve which advocate mobile to store on an appointment.
 * Non-office roles (advocate-only) are locked to their own mobile.
 */
export function resolveBookingAdvocateMobile(opts: {
  roles: UserRole[];
  actorMobile: string;
  requestedMobile?: string | null;
}): { mobile: string | null; error?: string } {
  const self = normalizeMobile(opts.actorMobile);
  if (!self) {
    return { mobile: null, error: "Your login mobile is invalid" };
  }

  if (!canBookForAnyAdvocate(opts.roles)) {
    return { mobile: self };
  }

  const requested = opts.requestedMobile?.trim();
  if (!requested) {
    return { mobile: null, error: "Select an advocate" };
  }

  const normalized = normalizeMobile(requested);
  if (!normalized) {
    return { mobile: null, error: "Select a valid advocate" };
  }

  return { mobile: normalized };
}

export function tenDigitMobile(mobile: string): string {
  return displayMobile(normalizeMobile(mobile) ?? mobile);
}
