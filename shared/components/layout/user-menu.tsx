"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/shared/components/user/user-avatar";
import { personDisplayName } from "@/shared/lib/person";
import { performLogout } from "@/features/auth/lib/perform-logout";
import { displayMobile } from "@/lib/auth/mobile";
import type { PublicUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { useSidebar } from "@/components/ui/sidebar";

export function UserMenu({
  user,
  variant = "header",
  onNavigate,
}: {
  user: PublicUser;
  variant?: "header" | "sidebar";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const displayName = personDisplayName({
    name: user.name,
    mobile: user.mobile,
    unitId: user.unitId,
    fallback: "Profile",
  });
  const mobileLabel = displayMobile(user.mobile);
  const isSidebar = variant === "sidebar";

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    await performLogout(router);
    setLoading(false);
  }

  if (isSidebar) {
    return (
      <SidebarUserMenu
        user={user}
        displayName={displayName}
        mobileLabel={mobileLabel}
        loading={loading}
        onLogout={handleLogout}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 max-w-48 gap-2 rounded-full px-1.5 hover:bg-muted sm:max-w-56 sm:pr-2"
          aria-label={`Account menu for ${displayName}`}
        >
          <UserAvatar name={displayName} photoUrl={user.photoUrl} size="sm" />
          <span className="hidden min-w-0 truncate text-sm font-medium text-navy sm:inline">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <UserMenuContent
        displayName={displayName}
        mobileLabel={mobileLabel}
        designation={user.designation}
        loading={loading}
        onLogout={handleLogout}
        onNavigate={onNavigate}
        align="end"
        side="bottom"
      />
    </DropdownMenu>
  );
}

function SidebarUserMenu({
  user,
  displayName,
  mobileLabel,
  loading,
  onLogout,
  onNavigate,
}: {
  user: PublicUser;
  displayName: string;
  mobileLabel: string;
  loading: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start gap-2 rounded-lg px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "size-8 justify-center p-0"
          )}
          aria-label={`Account menu for ${displayName}`}
          title={displayName}
        >
          <UserAvatar name={displayName} photoUrl={user.photoUrl} size="sm" />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-navy">
                  {displayName}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                  {user.designation || `+91 ${mobileLabel}`}
                </span>
              </span>
              <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <UserMenuContent
        displayName={displayName}
        mobileLabel={mobileLabel}
        designation={user.designation}
        loading={loading}
        onLogout={onLogout}
        onNavigate={onNavigate}
        align="start"
        side="top"
      />
    </DropdownMenu>
  );
}

function UserMenuContent({
  displayName,
  mobileLabel,
  designation,
  loading,
  onLogout,
  onNavigate,
  align,
  side,
}: {
  displayName: string;
  mobileLabel: string;
  designation?: string;
  loading: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
  align: "start" | "end";
  side: "top" | "bottom";
}) {
  return (
    <DropdownMenuContent align={align} side={side} className="w-56">
      <DropdownMenuLabel className="normal-case">
        <p className="truncate text-sm font-semibold text-navy">{displayName}</p>
        <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
          {designation ? `${designation} · ` : ""}
          +91 {mobileLabel}
        </p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/profile" onClick={() => onNavigate?.()}>
          <UserRound />
          Profile
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={loading}
        onSelect={(e) => {
          e.preventDefault();
          onLogout();
        }}
      >
        <LogOut />
        {loading ? "Signing out…" : "Log out"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
