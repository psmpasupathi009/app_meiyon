/**
 * Feature flags — unfinished modules stay off so nav stays clean.
 * Flip on as each MVP slice ships.
 */
export const modules = {
  enabled: {
    dashboard: true,
    employees: true,
    permissions: true,
    activity: true,
    clients: true,
    appointments: true,
    cases: true,
    accounts: true,
    expenses: true,
    hrms: true,
    dak: true,
    tasks: true,
    reports: true,
  },
} as const;

export type AppModule = keyof typeof modules.enabled;

export function isModuleEnabled(module: AppModule): boolean {
  return modules.enabled[module] === true;
}
