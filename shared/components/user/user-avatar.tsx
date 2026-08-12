"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { personInitials } from "@/shared/lib/person";

type UserAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-24 text-2xl",
} as const;

export function UserAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const label = personInitials(name);
  const showPhoto = Boolean(photoUrl) && photoUrl !== failedUrl;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy/10 font-semibold text-navy ring-1 ring-border",
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(photoUrl ?? null)}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
