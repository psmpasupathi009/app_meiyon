import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { NotificationsPage } from "@/features/notifications/components/notifications-page";

export default async function NotificationsRoute() {
  const user = await getSessionUser();
  if (!user) return <ForbiddenState />;
  return <NotificationsPage />;
}
