import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { AvailabilityPage } from "@/features/availability/components/availability-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("appointments") ||
    !user.permissions.includes("appointments.view")
  ) {
    return <ForbiddenState />;
  }
  return <AvailabilityPage user={user} />;
}
