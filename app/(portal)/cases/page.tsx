import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { CasesPage } from "@/features/cases/components/cases-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("cases") ||
    !user.permissions.includes("cases.view")
  ) {
    return <ForbiddenState />;
  }
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CasesPage user={user} />
    </Suspense>
  );
}
