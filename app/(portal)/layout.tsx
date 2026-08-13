import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@meiyon/ui";
import {
  isModuleEnabled,
  navItems,
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
  planHasModule,
  modulePlanKey,
  type NavItem,
} from "@meiyon/config";
import { getSessionUser } from "@/lib/auth/session-user";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { prisma } from "@meiyon/db";
import { DbUnavailable } from "@/features/auth/components/db-unavailable";
import { isDbUnreachableError } from "@/lib/db/unreachable";
import type { PublicUser } from "@/lib/auth/session";
import { getOfficeSubscription } from "@/lib/billing/access";

function visibleNav(user: PublicUser, planCode: string | null): NavItem[] {
  const perms = new Set(user.permissions);
  const clientOnly = isClientOnlyUser(user.roles);
  const isAdmin = user.roles.some((r) => r === "admin" || r === "sub_admin");

  return navItems.filter((item) => {
    if (item.href === "/billing" && !isAdmin) return false;

    if (planCode && item.module !== "dashboard" && item.href !== "/billing") {
      const planKey = modulePlanKey(item.module);
      if (!planHasModule(planCode, planKey)) return false;
    }

    if (!isModuleEnabled(item.module)) return false;
    if (item.clientOnly && !clientOnly) return false;
    if (item.staffOnly && clientOnly) return false;

    if (item.gates?.length) {
      return item.gates.some(
        (g) => isModuleEnabled(g.module) && perms.has(g.permission)
      );
    }

    const key = `${item.permission.module}.${item.permission.action}`;
    return perms.has(key);
  });
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: PublicUser | null = null;
  let dbUnreachable = false;

  try {
    user = await getSessionUser();
  } catch (error) {
    if (isDbUnreachableError(error)) {
      dbUnreachable = true;
    } else {
      throw error;
    }
  }

  if (dbUnreachable) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
        <DbUnavailable />
      </div>
    );
  }

  if (!user) redirect("/login");

  const office = await prisma.office.findUnique({
    where: { unitId: user.officeUnitId },
    select: { id: true, displayName: true, name: true },
  });
  const subCtx = office ? await getOfficeSubscription(office.id) : null;

  const planCode = subCtx?.plan?.code ?? null;
  const nav = visibleNav(user, planCode);
  const grouped = NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    items: nav.filter((n) => n.group === group),
  })).filter((g) => g.items.length > 0);

  const navGroups = grouped.map((g) => ({
    id: g.group,
    label: g.label,
    items: g.items.map((i) => ({ href: i.href, label: i.label })),
  }));

  const pastDue = subCtx?.subscription.status === "past_due";

  return (
    <AppShell
      brand="MEIYON"
      subtitle={office?.displayName ?? office?.name ?? "Office"}
      subtitleBadge={subCtx?.plan?.name}
      navGroups={navGroups}
      userName={user.name ?? "Staff"}
      userMeta={user.roles.join(", ")}
      banner={
        pastDue ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:px-6">
            Payment past due — some features may be restricted.{" "}
            <Link href="/billing" className="font-semibold underline">
              Update billing
            </Link>
          </div>
        ) : undefined
      }
      logoutAction={
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
