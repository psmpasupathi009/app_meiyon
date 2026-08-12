"use client";

import { cn } from "@/lib/utils/cn";
import { UserAvatar } from "@/shared/components/user/user-avatar";
import { personDisplayName } from "@/shared/lib/person";

type PersonChipProps = {
  name?: string | null;
  photoUrl?: string | null;
  mobile?: string | null;
  unitId?: string | null;
  /** Second line under the name (email, designation, unit ID). */
  subtitle?: string | null;
  size?: "sm" | "md";
  className?: string;
  /** Hide the name text (avatar only). */
  avatarOnly?: boolean;
  fallback?: string;
};

/**
 * Consistent person display: photo (or initials) + proper name.
 * Use anywhere we show an employee / advocate / logged-in user.
 */
export function PersonChip({
  name,
  photoUrl,
  mobile,
  unitId,
  subtitle,
  size = "sm",
  className,
  avatarOnly = false,
  fallback,
}: PersonChipProps) {
  const display = personDisplayName({ name, mobile, unitId, fallback });

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <UserAvatar name={display} photoUrl={photoUrl} size={size} />
      {avatarOnly ? null : (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy">{display}</p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
