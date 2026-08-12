import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ActivityPage } from "@/features/activity/components/activity-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("activity") ||
    !user.permissions.includes("activity.view")
  ) {
    return <ForbiddenState />;
  }
  return <ActivityPage />;
}
