import type { UserRole } from "@prisma/client";

export type PermissionKey = `${string}.${string}`;

/** Seed matrix — empty matrix = broken office. */
export const PERMISSION_CATALOG: {
  module: string;
  action: string;
}[] = [
  { module: "dashboard", action: "view" },
  { module: "employees", action: "view" },
  { module: "employees", action: "create" },
  { module: "employees", action: "edit" },
  { module: "employees", action: "deactivate" },
  { module: "permissions", action: "view" },
  { module: "permissions", action: "edit" },
  { module: "activity", action: "view" },
  { module: "clients", action: "view" },
  { module: "clients", action: "create" },
  { module: "clients", action: "edit" },
  { module: "appointments", action: "view" },
  { module: "appointments", action: "create" },
  { module: "appointments", action: "edit" },
  { module: "appointments", action: "cancel" },
  { module: "cases", action: "view" },
  { module: "cases", action: "create" },
  { module: "cases", action: "edit" },
  { module: "cases", action: "upload" },
  { module: "accounts", action: "view" },
  { module: "accounts", action: "create" },
  { module: "accounts", action: "edit" },
  { module: "accounts", action: "upload" },
  { module: "expenses", action: "view" },
  { module: "expenses", action: "create" },
  { module: "expenses", action: "edit" },
  { module: "expenses", action: "upload" },
  { module: "hrms", action: "view" },
  { module: "hrms", action: "own_attendance" },
  { module: "hrms", action: "own_leave" },
  { module: "hrms", action: "manage_attendance" },
  { module: "hrms", action: "approve_leave" },
  { module: "dak", action: "view" },
  { module: "dak", action: "create" },
  { module: "dak", action: "edit" },
  { module: "tasks", action: "view" },
  { module: "tasks", action: "create" },
  { module: "tasks", action: "edit" },
  { module: "reports", action: "view" },
];

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Home",
  employees: "Employees",
  permissions: "Permissions",
  activity: "Activity",
  clients: "Clients",
  appointments: "Appointments",
  cases: "Cases",
  accounts: "Accounts",
  expenses: "Office expenses",
  hrms: "HRMS",
  dak: "Dak / Postal",
  tasks: "Work allotment",
  reports: "Reports",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  deactivate: "Deactivate",
  cancel: "Cancel",
  upload: "Upload / import",
  own_attendance: "Own check-in",
  own_leave: "Own leave",
  manage_attendance: "Team attendance",
  approve_leave: "Approve leave",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sub_admin: "Sub admin",
  staff: "Staff",
  advocate: "Advocate",
  accountant: "Accountant",
  client: "Client",
};

export const ROLE_BLURBS: Record<UserRole, string> = {
  admin: "Full office control — cannot be restricted",
  sub_admin: "Day-to-day ops — Office Manager / HR Manager access without full admin",
  staff: "Clerks, PA, paralegals, receptionist, computer operator, messenger, driver, and interns",
  advocate: "Case and client work for any counsel title (Advocate, AOR, Counsel, Senior Associate, Notary, …)",
  accountant: "Cash book and fees — Accounts Manager, Accountant, Accounts Assistant, Cashier",
  client: "Portal login — own cases, hearings, appointments, and documents only",
};

/** Roles shown in employee forms and the permissions matrix editor. */
export const EMPLOYEE_ROLES: UserRole[] = [
  "admin",
  "sub_admin",
  "staff",
  "advocate",
  "accountant",
];

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

type Matrix = Record<UserRole, Set<PermissionKey>>;

function key(module: string, action: string): PermissionKey {
  return `${module}.${action}` as PermissionKey;
}

function buildMatrix(): Matrix {
  const empty = (): Set<PermissionKey> => new Set();
  const m: Matrix = {
    admin: empty(),
    sub_admin: empty(),
    staff: empty(),
    advocate: empty(),
    accountant: empty(),
    client: empty(),
  };

  const grant = (role: UserRole, module: string, action: string) => {
    m[role].add(key(module, action));
  };

  const all = (role: UserRole, pairs: [string, string][]) => {
    for (const [module, action] of pairs) grant(role, module, action);
  };

  // Staff roles: dashboard + own HRMS. Clients get a narrow grant below.
  for (const role of Object.keys(m) as UserRole[]) {
    if (role === "client") continue;
    grant(role, "dashboard", "view");
    grant(role, "hrms", "view");
    grant(role, "hrms", "own_attendance");
    grant(role, "hrms", "own_leave");
  }

  // client — own matters only (API hard-scopes by clientUnitId)
  all("client", [
    ["dashboard", "view"],
    ["cases", "view"],
    ["cases", "upload"],
    ["appointments", "view"],
    ["appointments", "create"],
    ["appointments", "cancel"],
  ]);

  // admin — everything in catalog
  for (const { module, action } of PERMISSION_CATALOG) {
    grant("admin", module, action);
  }

  // sub_admin — can manage employees (not assign admin; API guard enforces that)
  all("sub_admin", [
    ["employees", "view"],
    ["employees", "create"],
    ["employees", "edit"],
    ["employees", "deactivate"],
    ["activity", "view"],
    ["clients", "view"],
    ["clients", "create"],
    ["clients", "edit"],
    ["appointments", "view"],
    ["appointments", "create"],
    ["appointments", "edit"],
    ["appointments", "cancel"],
    ["cases", "view"],
    ["cases", "create"],
    ["cases", "edit"],
    ["cases", "upload"],
    ["expenses", "view"],
    ["expenses", "create"],
    ["expenses", "edit"],
    ["expenses", "upload"],
    ["hrms", "manage_attendance"],
    ["hrms", "approve_leave"],
    ["dak", "view"],
    ["dak", "create"],
    ["dak", "edit"],
    ["tasks", "view"],
    ["tasks", "create"],
    ["tasks", "edit"],
    ["reports", "view"],
  ]);

  // advocate
  all("advocate", [
    ["clients", "view"],
    ["clients", "create"],
    ["clients", "edit"],
    ["appointments", "view"],
    ["appointments", "create"],
    ["appointments", "edit"],
    ["appointments", "cancel"],
    ["cases", "view"],
    ["cases", "create"],
    ["cases", "edit"],
    ["cases", "upload"],
    ["dak", "view"],
    ["dak", "create"],
    ["tasks", "view"],
    ["tasks", "create"],
    ["tasks", "edit"],
  ]);

  // staff
  all("staff", [
    ["clients", "view"],
    ["clients", "create"],
    ["clients", "edit"],
    ["appointments", "view"],
    ["appointments", "create"],
    ["appointments", "edit"],
    ["appointments", "cancel"],
    ["cases", "view"],
    ["cases", "create"],
    ["cases", "edit"],
    ["cases", "upload"],
    ["dak", "view"],
    ["dak", "create"],
    ["dak", "edit"],
    ["tasks", "view"],
    ["tasks", "create"],
    ["tasks", "edit"],
  ]);

  // accountant — cash book + read clients/cases + CSV import when granted upload
  all("accountant", [
    ["clients", "view"],
    ["cases", "view"],
    ["accounts", "view"],
    ["accounts", "create"],
    ["accounts", "edit"],
    ["accounts", "upload"],
    ["reports", "view"],
  ]);

  return m;
}

const MATRIX = buildMatrix();

export function defaultAllowed(
  role: UserRole,
  module: string,
  action: string
): boolean {
  return MATRIX[role]?.has(key(module, action)) ?? false;
}

/** Flat rows for prisma seed / reset-to-defaults. */
export function permissionSeedRows(): {
  role: UserRole;
  module: string;
  action: string;
  allowed: boolean;
}[] {
  const roles = Object.keys(MATRIX) as UserRole[];
  const rows: {
    role: UserRole;
    module: string;
    action: string;
    allowed: boolean;
  }[] = [];

  for (const role of roles) {
    for (const { module, action } of PERMISSION_CATALOG) {
      rows.push({
        role,
        module,
        action,
        allowed: defaultAllowed(role, module, action),
      });
    }
  }

  return rows;
}
