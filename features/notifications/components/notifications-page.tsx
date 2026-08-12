"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronRight } from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useNotificationsInbox,
  type InboxFilter,
} from "@/features/notifications/hooks/use-notifications-inbox";
import {
  CATEGORY_ICON_CLASS,
  categoryForType,
  formatRelativeWhen,
  typeLabel,
  urgencyTone,
} from "@/features/notifications/lib/notification-meta";
import { typeIcon } from "@/features/notifications/lib/notification-icons";
import type { NotificationPayload } from "@/lib/notifications/sse-hub";
import { cn } from "@/lib/utils/cn";

const FILTER_OPTIONS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "hearings", label: "Hearings" },
  { id: "tasks", label: "Tasks" },
  { id: "leave", label: "Leave" },
  { id: "cases", label: "Cases" },
  { id: "system", label: "System" },
];

function urgencyBadgeVariant(
  type: string
): "destructive" | "warning" | "default" | "muted" {
  const tone = urgencyTone(type);
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "default";
  return "muted";
}

export function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [page, setPage] = useState(1);
  const {
    items,
    total,
    unread,
    loading,
    pageSize,
    markRead,
    markAllRead,
  } = useNotificationsInbox(filter, page);

  // Keep page in range after unread filter shrinks the list
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  async function openItem(item: NotificationPayload) {
    if (!item.readAt) await markRead(item.unitId);
    if (item.href) router.push(item.href);
  }

  function onFilterChange(next: InboxFilter) {
    setFilter(next);
    setPage(1);
  }

  const filterLabel =
    FILTER_OPTIONS.find((o) => o.id === filter)?.label.toLowerCase() ?? "";

  return (
    <div className="w-full">
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread · stay on top of hearings, tasks, and office updates.`
            : "You're all caught up. New updates will land here."
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {unread > 0 ? (
              <Badge variant="default" className="h-6 w-fit px-2.5 tabular-nums">
                {unread} unread
              </Badge>
            ) : null}
            {unread > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 sm:mb-5">
        <FilterChipGroup
          options={FILTER_OPTIONS}
          value={filter}
          onChange={onFilterChange}
          size="sm"
          aria-label="Notification filters"
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="h-52 animate-pulse rounded-xl border border-border/80 bg-card" />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            filter === "unread"
              ? "No unread notifications"
              : filter === "all"
                ? "Inbox is empty"
                : `No ${filterLabel} notifications`
          }
          description={
            filter === "unread"
              ? "When something needs your attention, it will show up here."
              : "Updates about hearings, tasks, leave, and cases will appear in this inbox."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 sm:w-12"> </TableHead>
                <TableHead className="hidden w-36 sm:table-cell">Type</TableHead>
                <TableHead>Notification</TableHead>
                <TableHead className="w-24 text-right sm:w-28">When</TableHead>
                <TableHead className="hidden w-16 md:table-cell"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isUnread = !item.readAt;
                const category = categoryForType(item.type);
                const Icon = typeIcon(item.type);

                return (
                  <TableRow
                    key={item.unitId}
                    className={cn(
                      "cursor-pointer",
                      isUnread && "bg-brand/3 dark:bg-brand/10"
                    )}
                    onClick={() => void openItem(item)}
                  >
                    <TableCell className="pr-0">
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          isUnread
                            ? CATEGORY_ICON_CLASS[category]
                            : "bg-muted/80 text-muted-foreground"
                        )}
                        aria-hidden
                      >
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={urgencyBadgeVariant(item.type)}
                        className="max-w-36 truncate"
                      >
                        {typeLabel(item.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "line-clamp-1",
                              isUnread
                                ? "font-semibold text-navy"
                                : "font-medium text-foreground/80"
                            )}
                          >
                            {item.title}
                          </p>
                          {item.body ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2 sm:text-sm">
                              {item.body}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs capitalize text-muted-foreground sm:hidden">
                            {typeLabel(item.type)}
                          </p>
                        </div>
                        {isUnread ? (
                          <span
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                            aria-label="Unread"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
                      <time dateTime={item.createdAt}>
                        {formatRelativeWhen(item.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.href ? (
                        <ChevronRight
                          className="ml-auto size-4 text-muted-foreground/60"
                          aria-hidden
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
