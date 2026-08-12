import { apiHandler, jsonOkList, parsePagination } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { toNotificationPayload, unreadNotificationWhere } from "@/lib/notifications/notify";
import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  typesForCategory,
  type NotificationCategory,
} from "@/features/notifications/lib/notification-meta";

function parseCategory(raw: string | null): NotificationCategory | null {
  if (!raw) return null;
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as NotificationCategory)
    : null;
}

function parseType(raw: string | null): string | null {
  if (!raw) return null;
  return (ALL_NOTIFICATION_TYPES as readonly string[]).includes(raw) ? raw : null;
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const unreadOnly = searchParams.get("unread") === "1";
  const category = parseCategory(searchParams.get("category"));
  const type = parseType(searchParams.get("type"));

  const typeFilter = type
    ? { type }
    : category === "system"
      ? {
          type: {
            notIn: NOTIFICATION_CATEGORIES.filter((c) => c !== "system").flatMap(
              typesForCategory
            ),
          },
        }
      : category
        ? { type: { in: typesForCategory(category) } }
        : {};

  const where = {
    officeId: user.officeId,
    userId: user.id,
    ...(unreadOnly ? unreadNotificationWhere : {}),
    ...typeFilter,
  };

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return jsonOkList(rows.map(toNotificationPayload), {
    page,
    pageSize,
    total,
  });
});
