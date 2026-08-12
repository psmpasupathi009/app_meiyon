import { Suspense } from "react";
import { WelcomeOverview } from "@/features/home/components/welcome-overview";
import { ClientHomeOverview } from "@/features/home/components/client-home-overview";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { isModuleEnabled } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { buildDashboardSummary } from "@/features/home/server/dashboard-summary";
import type { DashboardSummary } from "@/features/home/components/welcome-helpers";
import { isClientOnlyUser } from "@/lib/auth/client-portal";

/** Session is request-cached with layout — one DB read per navigation. */
export default async function HomePage() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("dashboard") ||
    !(user.permissions ?? []).includes("dashboard.view")
  ) {
    return <ForbiddenState />;
  }

  if (isClientOnlyUser(user.roles)) {
    return <ClientHomeOverview user={user} />;
  }

  const dbUser = await prisma.user.findFirst({
    where: { unitId: user.unitId, officeUnitId: user.officeUnitId },
    select: { id: true, officeId: true, roles: true, unitId: true },
  });

  let initialSummary: DashboardSummary | null = null;
  if (dbUser) {
    try {
      initialSummary = (await buildDashboardSummary({
        ...dbUser,
        permissions: user.permissions,
      })) as DashboardSummary;
    } catch {
      initialSummary = null;
    }
  }

  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <WelcomeOverview user={user} initialSummary={initialSummary} />
    </Suspense>
  );
}
