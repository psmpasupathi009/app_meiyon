"use client";

import { useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/shared/hooks/use-notifications";
import { NotificationItem } from "@/features/notifications/components/notification-item";
import type { NotificationPayload } from "@/lib/notifications/sse-hub";

export function NotificationBell() {
  const router = useRouter();
  const { items, unread, loading, ensureList, markRead, markAllRead } =
    useNotifications();

  async function openItem(item: NotificationPayload) {
    if (!item.readAt) await markRead(item.unitId);
    if (item.href) router.push(item.href);
  }

  function goToInbox() {
    router.push("/notifications");
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void ensureList();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0 text-navy hover:bg-muted hover:text-navy"
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread`
              : "Notifications"
          }
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,22rem)] overflow-hidden p-0 sm:w-96"
      >
        <div className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={goToInbox}
          >
            <DropdownMenuLabel className="cursor-pointer p-0 text-sm font-semibold normal-case tracking-tight text-navy hover:text-brand">
              Notifications
            </DropdownMenuLabel>
            {unread > 0 ? (
              <Badge variant="default" className="h-5 px-1.5 text-[10px] tabular-nums">
                {unread}
              </Badge>
            ) : null}
          </button>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-navy sm:self-auto"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[min(24rem,55vh)] overflow-y-auto p-1.5">
          {loading && items.length === 0 ? (
            <div className="space-y-1 px-1 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-start gap-3 rounded-lg px-2 py-2.5"
                >
                  <div className="size-9 shrink-0 rounded-xl bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Bell className="size-4" strokeWidth={1.75} />
              </span>
              <p className="text-sm font-medium text-navy">All clear</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            items.map((item) => (
              <NotificationItem
                key={item.unitId}
                item={item}
                onOpen={openItem}
                compact
              />
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="bg-muted/30 p-1.5">
          <button
            type="button"
            onClick={goToInbox}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-background"
          >
            View all notifications
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
