import { apiHandler, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { unreadNotificationWhere } from "@/lib/notifications/notify";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const result = await prisma.notification.updateMany({
    where: { officeId: user.officeId, userId: user.id, ...unreadNotificationWhere },
    data: { readAt: new Date() },
  });

  return jsonOk({ updated: result.count });
});
