import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { toNotificationPayload } from "@/lib/notifications/notify";

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.notification.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item || item.userId !== user.id) {
    return jsonFail("NOT_FOUND", "Notification not found", 404);
  }

  const updated = item.readAt
    ? item
    : await prisma.notification.update({
        where: { id: item.id },
        data: { readAt: new Date() },
      });

  return jsonOk({ notification: toNotificationPayload(updated) });
});
