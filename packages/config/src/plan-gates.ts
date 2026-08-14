/** Plan module entitlements — mirrors Super Admin seed + build doc. */
export type PlanCode = "starter" | "professional" | "enterprise";

export const PLAN_MODULES: Record<PlanCode, string[]> = {
  starter: [
    "dashboard", "clients", "cases", "diary", "appointments", "availability",
    "tasks", "employees", "permissions", "activity", "notifications",
    "court_roster", "client_portal", "mobile_apps", "reports_basic",
  ],
  professional: [
    "dashboard", "clients", "cases", "diary", "appointments", "availability",
    "tasks", "employees", "permissions", "activity", "notifications",
    "court_roster", "client_portal", "mobile_apps", "reports_full", "accounts", "expenses",
    "dak", "documents", "csv_imports",
  ],
  enterprise: [
    "dashboard", "clients", "cases", "diary", "appointments", "availability",
    "tasks", "employees", "permissions", "activity", "notifications",
    "court_roster", "client_portal", "mobile_apps", "reports_full", "accounts", "expenses",
    "dak", "documents", "csv_imports", "hrms", "hearing_sms", "branding_full",
  ],
};

export function planHasModule(planCode: string, moduleKey: string): boolean {
  const modules = PLAN_MODULES[planCode as PlanCode];
  if (!modules) return false;
  return modules.includes(moduleKey);
}

/** Map nav / API module to plan entitlement key */
export function modulePlanKey(module: string): string {
  const map: Record<string, string> = {
    accounts: "accounts",
    expenses: "expenses",
    dak: "dak",
    documents: "documents",
    csv_imports: "csv_imports",
    hrms: "hrms",
    reports: "reports_full",
  };
  return map[module] ?? module;
}
