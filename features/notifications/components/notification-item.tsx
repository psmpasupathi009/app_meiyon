"use client";

import { createElement } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NotificationPayload } from "@/lib/notifications/sse-hub";
import {
  CATEGORY_ICON_CLASS,
  categoryForType,
  formatRelativeWhen,
  typeLabel,
  urgencyTone,
} from "@/features/notifications/lib/notification-meta";
import { typeIcon } from "@/features/notifications/lib/notification-icons";

type NotificationItemProps = {
  item: NotificationPayload;
  onOpen: (item: NotificationPayload) => void;
  /** Compact layout for the header dropdown peek. */
  compact?: boolean;
};

export function NotificationItem({
  item,
  onOpen,
  compact = false,
}: NotificationItemProps) {
  const unread = !item.readAt;
  const urgency = urgencyTone(item.type);
  const category = categoryForType(item.type);
  const hasLink = Boolean(item.href);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "group relative flex w-full items-start gap-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact
          ? "rounded-lg px-2.5 py-2.5 hover:bg-muted/70"
          : cn(
              "gap-3.5 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4",
              "hover:bg-muted/40",
              unread && "bg-brand/3 dark:bg-brand/10"
            ),
        !compact &&
          unread &&
          urgency === "danger" &&
          "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-destructive",
        !compact &&
          unread &&
          urgency === "warning" &&
          "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-amber-500",
        !compact &&
          unread &&
          urgency === "info" &&
          "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-500",
        !compact &&
          unread &&
          !urgency &&
          "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-brand"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-xl",
          compact ? "size-9" : "size-11",
          unread
            ? CATEGORY_ICON_CLASS[category]
            : "bg-muted/80 text-muted-foreground"
        )}
        aria-hidden
      >
        {createElement(typeIcon(item.type), {
          className: compact ? "size-4" : "size-4.5",
          strokeWidth: 1.75,
        })}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 leading-snug",
              compact ? "text-[13px]" : "text-sm sm:text-[15px]",
              unread
                ? "font-semibold text-navy"
                : "font-medium text-foreground/75"
            )}
          >
            <span className="line-clamp-2">{item.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 pt-0.5">
            <time
              dateTime={item.createdAt}
              className={cn(
                "tabular-nums text-muted-foreground",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              {formatRelativeWhen(item.createdAt)}
            </time>
            {unread ? (
              <span
                className="size-2 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px] shadow-brand/15"
                aria-label="Unread"
              />
            ) : null}
          </span>
        </span>

        {item.body ? (
          <span
            className={cn(
              "mt-1 block leading-relaxed text-muted-foreground",
              compact ? "line-clamp-2 text-xs" : "line-clamp-2 text-[13px] sm:text-sm",
              !unread && "opacity-80"
            )}
          >
            {item.body}
          </span>
        ) : null}

        <span
          className={cn(
            "mt-1.5 flex items-center gap-2",
            compact ? "mt-1" : "mt-2"
          )}
        >
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 font-medium capitalize",
              compact ? "text-[10px]" : "text-[11px]",
              unread
                ? "bg-muted text-muted-foreground"
                : "bg-transparent text-muted-foreground/70"
            )}
          >
            {typeLabel(item.type)}
          </span>
          {!compact && hasLink ? (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-navy/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Open
              <ChevronRight className="size-3" />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
