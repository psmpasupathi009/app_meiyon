import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { DakPage } from "@/features/dak/components/dak-page";
import { isModuleEnabled } from "@meiyon/config";
import { officeHasPlanModule } from "@/lib/auth/plan-gate";
import { UpgradePrompt } from "@meiyon/ui";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("dak") ||
    !user.permissions.includes("dak.view")
  ) {
    return <ForbiddenState />;
  }
  if (!(await officeHasPlanModule(user.officeUnitId, "dak"))) {
    return <UpgradePrompt module="dak" />;
  }
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <DakPage user={user} />
    </Suspense>
  );
}
