import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { AccountsPage } from "@/features/accounts/components/accounts-page";
import { isModuleEnabled } from "@meiyon/config";
import { officeHasPlanModule } from "@/lib/auth/plan-gate";
import { UpgradePrompt } from "@meiyon/ui";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("accounts") ||
    !user.permissions.includes("accounts.view")
  ) {
    return <ForbiddenState />;
  }

  if (!(await officeHasPlanModule(user.officeUnitId, "accounts"))) {
    return <UpgradePrompt module="accounts" />;
  }

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AccountsPage user={user} />
    </Suspense>
  );
}
