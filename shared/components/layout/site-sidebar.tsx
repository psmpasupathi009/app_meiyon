"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  ClipboardCheck,
  FileBarChart,
  FileInput,
  History,
  Home,
  ListTodo,
  Scale,
  Shield,
  Users,
  Wallet,
  Receipt,
  CalendarDays,
  ClipboardList,
  Clock3,
} from "lucide-react";
import {
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
  navItems,
} from "@meiyon/config";
import { brand } from "@/config/company/brand";
import { isModuleEnabled, type AppModule } from "@meiyon/config";
import type { PublicUser } from "@/lib/auth/session";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { UserMenu } from "@/shared/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const ICONS: Partial<
  Record<AppModule | string, React.ComponentType<{ className?: string }>>
> = {
  dashboard: Home,
  employees: Users,
  permissions: Shield,
  activity: History,
  clients: Briefcase,
  cases: Scale,
  accounts: Wallet,
  expenses: Receipt,
  appointments: CalendarDays,
  hrms: ClipboardList,
  tasks: ListTodo,
  dak: FileInput,
  reports: FileBarChart,
  diary: BookOpen,
  availability: Clock3,
  checklist: ClipboardCheck,
};

function iconForHref(href: string, module: AppModule) {
  if (href === "/availability") return Clock3;
  if (href === "/diary") return BookOpen;
  if (href === "/documents") return FileInput;
  return ICONS[module] ?? Home;
}

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={() => onNavigate?.()}
      className="flex size-8 items-center justify-center rounded-lg outline-none ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2 group-data-[collapsible=icon]:size-8"
      title={brand.name}
    >
      <span className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-sidebar-border">
        <Image
          src={brand.logoSrc}
          alt=""
          width={32}
          height={32}
          className="size-full object-cover"
          priority
        />
      </span>
      <span className="sr-only">{brand.name}</span>
    </Link>
  );
}

export function SiteSidebar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const perms = new Set(user.permissions);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isClient = isClientOnlyUser(user.roles);
  const items = navItems.filter((item) => {
    if (item.clientOnly && !isClient) return false;
    if (item.staffOnly && isClient) return false;
    if (item.gates?.length) {
      return item.gates.some(
        (g) => isModuleEnabled(g.module) && perms.has(g.permission)
      );
    }
    if (!isModuleEnabled(item.module)) return false;
    return perms.has(`${item.permission.module}.${item.permission.action}`);
  });

  const grouped = NAV_GROUP_ORDER.map((groupId) => ({
    groupId,
    label: NAV_GROUP_LABELS[groupId],
    items: items.filter((i) => i.group === groupId),
  })).filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="print:hidden">
      <SidebarHeader className="flex flex-row items-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))] group-data-[collapsible=icon]:justify-center">
        <SidebarBrand onNavigate={closeMobile} />
      </SidebarHeader>

      <SidebarContent>
        {grouped.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            No modules available.
          </p>
        ) : (
          grouped.map((group) => (
            <SidebarGroup key={group.groupId}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    const Icon = iconForHref(item.href, item.module);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Link href={item.href} onClick={closeMobile}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <UserMenu user={user} variant="sidebar" onNavigate={closeMobile} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
