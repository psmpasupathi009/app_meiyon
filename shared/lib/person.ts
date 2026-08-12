import { displayMobile } from "@/lib/auth/mobile";
import { userPhotoUrl } from "@/lib/auth/user-photo";

/** Initials for avatar fallback — first + last word, or first two letters. */
export function personInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/**
 * Single display name for people site-wide.
 * Prefer real name → 10-digit mobile → unit ID → fallback.
 */
export function personDisplayName(opts: {
  name?: string | null;
  mobile?: string | null;
  unitId?: string | null;
  fallback?: string;
}): string {
  const name = opts.name?.trim();
  if (name) return name;
  const mobile = opts.mobile?.trim();
  if (mobile) {
    const ten = displayMobile(mobile);
    if (ten) return ten;
  }
  const unitId = opts.unitId?.trim();
  if (unitId) return unitId;
  return opts.fallback ?? "—";
}

/** First name for greetings (“Good morning, Ravi”). */
export function personFirstName(opts: {
  name?: string | null;
  fallback?: string;
}): string {
  const full = opts.name?.trim();
  if (!full) return opts.fallback ?? "there";
  return full.split(/\s+/)[0] ?? opts.fallback ?? "there";
}

/** Profile photo URL — client-safe wrapper around userPhotoUrl. */
export function personPhotoUrl(
  unitId: string | null | undefined,
  hasPhoto: boolean
): string | undefined {
  if (!unitId) return undefined;
  return userPhotoUrl(unitId, hasPhoto);
}
