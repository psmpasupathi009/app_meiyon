import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ExpensesPage } from "@/features/expenses/components/expenses-page";
import { isModuleEnabled } from "@meiyon/config";
import { officeHasPlanModule } from "@/lib/auth/plan-gate";
import { UpgradePrompt } from "@meiyon/ui";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("expenses") ||
    !user.permissions.includes("expenses.view")
  ) {
    return <ForbiddenState />;
  }
  if (!(await officeHasPlanModule(user.officeUnitId, "expenses"))) {
    return <UpgradePrompt module="expenses" />;
  }
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ExpensesPage user={user} />
    </Suspense>
  );
}
