import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { EmployeesPage } from "@/features/employees/components/employees-page";
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
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <EmployeesPage user={user} />
    </Suspense>
  );
}
