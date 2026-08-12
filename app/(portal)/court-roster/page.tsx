import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { CourtRosterPage } from "@/features/court-roster/components/court-roster-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("employees") ||
    !user.permissions.includes("employees.view")
  ) {
    return <ForbiddenState />;
  }
  return <CourtRosterPage user={user} />;
}
