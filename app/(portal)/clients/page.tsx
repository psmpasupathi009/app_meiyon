import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ClientsPage } from "@/features/clients/components/clients-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("clients") ||
    !user.permissions.includes("clients.view")
  ) {
    return <ForbiddenState />;
  }
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ClientsPage user={user} />
    </Suspense>
  );
}
