import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { HrmsPage } from "@/features/hrms/components/hrms-page";
import { isModuleEnabled } from "@meiyon/config";
import { officeHasPlanModule } from "@/lib/auth/plan-gate";
import { UpgradePrompt } from "@meiyon/ui";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("hrms") ||
    !user.permissions.includes("hrms.view")
  ) {
    return <ForbiddenState />;
  }
  if (!(await officeHasPlanModule(user.officeUnitId, "hrms"))) {
    return <UpgradePrompt module="hrms" />;
  }
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <HrmsPage user={user} />
    </Suspense>
  );
}
