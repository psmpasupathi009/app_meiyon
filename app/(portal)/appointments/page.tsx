import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { AppointmentsPage } from "@/features/appointments/components/appointments-page";
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
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <AppointmentsPage user={user} />
    </Suspense>
  );
}
