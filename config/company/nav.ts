import type { AppModule } from "@/config/company/modules";

export type NavGroupId =
  | "workspace"
  | "matters"
  | "schedule"
  | "office"
  | "admin";

export type NavItem = {
  href: string;
  label: string;
  module: AppModule;
  group: NavGroupId;
  /** At least one of these permissions is required to show the item. */
  permission: { module: string; action: string };
  /**
   * When set, show if any gate matches (module enabled + permission).
   * Used for Day board (cases | appointments | tasks).
   */
  gates?: Array<{ module: AppModule; permission: string }>;
  /** Only client portal users see this item. */
  clientOnly?: boolean;
  /** Hide from client portal users even when they hold the permission. */
  staffOnly?: boolean;
};

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  workspace: "Workspace",
  matters: "Matters",
  schedule: "Schedule",
  office: "Office",
  admin: "Admin",
};

/** Stable order for section rendering. */
export const NAV_GROUP_ORDER: NavGroupId[] = [
  "workspace",
  "matters",
  "schedule",
  "office",
  "admin",
];

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    module: "dashboard",
    group: "workspace",
    permission: { module: "dashboard", action: "view" },
  },
  {
    href: "/clients",
    label: "Clients",
    module: "clients",
    group: "matters",
    permission: { module: "clients", action: "view" },
    staffOnly: true,
  },
  {
    href: "/cases",
    label: "Cases",
    module: "cases",
    group: "matters",
    permission: { module: "cases", action: "view" },
  },
  {
    href: "/diary",
    label: "Day board",
    module: "cases",
    group: "matters",
    permission: { module: "cases", action: "view" },
    staffOnly: true,
    gates: [
      { module: "cases", permission: "cases.view" },
      { module: "appointments", permission: "appointments.view" },
      { module: "tasks", permission: "tasks.view" },
    ],
  },
  {
    href: "/documents",
    label: "Documents",
    module: "cases",
    group: "matters",
    permission: { module: "cases", action: "upload" },
    clientOnly: true,
  },
  {
    href: "/appointments",
    label: "Appointments",
    module: "appointments",
    group: "schedule",
    permission: { module: "appointments", action: "view" },
  },
  {
    href: "/availability",
    label: "Availability",
    module: "appointments",
    group: "schedule",
    permission: { module: "appointments", action: "view" },
    staffOnly: true,
  },
  {
    href: "/court-roster",
    label: "Court roster",
    module: "employees",
    group: "schedule",
    permission: { module: "employees", action: "view" },
    staffOnly: true,
  },
  {
    href: "/accounts",
    label: "Accounts",
    module: "accounts",
    group: "office",
    permission: { module: "accounts", action: "view" },
    staffOnly: true,
  },
  {
    href: "/expenses",
    label: "Office expenses",
    module: "expenses",
    group: "office",
    permission: { module: "expenses", action: "view" },
    staffOnly: true,
  },
  {
    href: "/hrms",
    label: "HRMS",
    module: "hrms",
    group: "office",
    permission: { module: "hrms", action: "view" },
    staffOnly: true,
  },
  {
    href: "/dak",
    label: "Postal",
    module: "dak",
    group: "office",
    permission: { module: "dak", action: "view" },
    staffOnly: true,
  },
  {
    href: "/tasks",
    label: "Work allotment",
    module: "tasks",
    group: "office",
    permission: { module: "tasks", action: "view" },
    staffOnly: true,
  },
  {
    href: "/reports",
    label: "Reports",
    module: "reports",
    group: "office",
    permission: { module: "reports", action: "view" },
    staffOnly: true,
  },
  {
    href: "/employees",
    label: "Employees",
    module: "employees",
    group: "admin",
    permission: { module: "employees", action: "view" },
    staffOnly: true,
  },
  {
    href: "/activity",
    label: "Activity",
    module: "activity",
    group: "admin",
    permission: { module: "activity", action: "view" },
    staffOnly: true,
  },
  {
    href: "/permissions",
    label: "Permissions",
    module: "permissions",
    group: "admin",
    permission: { module: "permissions", action: "view" },
    staffOnly: true,
  },
];
