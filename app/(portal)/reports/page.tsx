import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ReportsPage } from "@/features/reports/components/reports-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("reports") ||
    !user.permissions.includes("reports.view")
  ) {
    return <ForbiddenState />;
  }
  return <ReportsPage user={user} />;
}
