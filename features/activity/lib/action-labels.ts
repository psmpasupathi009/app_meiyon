/** Human labels for AuditLog.action values — allowlist only. */
export const ACTION_LABELS: Record<string, string> = {
  "client.create": "Created client",
  "client.update": "Updated client",
  "client.import": "Imported clients",
  "case.create": "Created case",
  "case.update": "Updated case",
  "case.status": "Changed case status",
  "case.import": "Imported cases",
  "hearing.create": "Added hearing",
  "hearing.adjourn": "Adjourned hearing",
  "hearings.import": "Imported hearings",
  "hearing.sms_manual": "Sent hearing SMS",
  "employee.create": "Created employee",
  "employee.update": "Updated employee",
  "employee.import": "Imported employees",
  "employee.deactivate": "Deactivated employee",
  "employee.reactivate": "Reactivated employee",
  "employee.force_reset_pin": "Forced PIN reset",
  "document.upload": "Uploaded document",
  "document.delete": "Deleted document",
  "payment.create": "Created payment",
  "payment.update": "Updated payment",
  "payment.void": "Voided payment",
  "payment.import": "Imported payments",
  "appointment.create": "Created appointment",
  "appointment.update": "Updated appointment",
  "appointment.cancel": "Cancelled appointment",
  "appointment.convert_case": "Converted appointment to case",
  "appointment.import": "Imported appointments",
  "task.create": "Created task",
  "task.update": "Updated task",
  "task.import": "Imported tasks",
  "dak.create": "Created dak entry",
  "dak.update": "Updated dak entry",
  "dak.delete": "Deleted dak entry",
  "dak.import": "Imported dak",
  "leave.apply": "Applied for leave",
  "leave.approved": "Approved leave",
  "leave.rejected": "Rejected leave",
  "leave.cancel": "Cancelled leave",
  "holiday.create": "Created office holiday",
  "holiday.update": "Updated office holiday",
  "holiday.delete": "Deleted office holiday",
  "permissions.matrix_update": "Updated permissions matrix",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/\./g, " · ").replace(/_/g, " ");
}

/** Verb tone for subtle left accent / badge colour. */
export type ActionTone = "create" | "update" | "delete" | "security" | "neutral";

export function actionTone(action: string): ActionTone {
  if (
    action.includes("delete") ||
    action.includes("void") ||
    action.includes("deactivate") ||
    action.includes("cancel") ||
    action.includes("reject")
  ) {
    return "delete";
  }
  if (
    action.includes("force_reset") ||
    action.includes("permissions") ||
    action.includes("reactivate")
  ) {
    return "security";
  }
  if (
    action.includes("create") ||
    action.includes("import") ||
    action.includes("upload") ||
    action.includes("apply") ||
    action.includes("convert")
  ) {
    return "create";
  }
  if (
    action.includes("update") ||
    action.includes("status") ||
    action.includes("adjourn") ||
    action.includes("approve") ||
    action.includes("sms")
  ) {
    return "update";
  }
  return "neutral";
}

export const ENTITY_LABELS: Record<string, string> = {
  Client: "Client",
  Case: "Case",
  User: "Employee",
  Document: "Document",
  CashPayment: "Payment",
  Appointment: "Appointment",
  OfficeTask: "Task",
  DakEntry: "Dak",
  LeaveRequest: "Leave",
  OfficeHoliday: "Holiday",
  Hearing: "Hearing",
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

/** Soft icon well by entity — matches notifications page language. */
export const ENTITY_ICON_CLASS: Record<string, string> = {
  Client: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  Case: "bg-brand/10 text-navy dark:text-navy",
  User: "bg-brand/12 text-navy dark:text-navy",
  Document: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
  CashPayment: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Appointment: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  OfficeTask: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  DakEntry: "bg-orange-500/12 text-orange-700 dark:text-orange-300",
  LeaveRequest: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  OfficeHoliday: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  Hearing: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

export function entityIconClass(entity: string): string {
  return ENTITY_ICON_CLASS[entity] ?? "bg-muted text-muted-foreground";
}

/** Portal href for a logged entity when known. */
export function entityHref(
  entity: string,
  entityUnitId: string | null | undefined,
  meta?: unknown
): string | null {
  if (!entityUnitId) return null;

  switch (entity) {
    case "Client":
      return `/clients/${entityUnitId}`;
    case "Case":
      return `/cases/${entityUnitId}`;
    case "User":
      return `/employees`;
    case "CashPayment":
      return `/accounts`;
    case "LeaveRequest":
    case "OfficeHoliday":
      return `/hrms`;
    case "OfficeTask":
      return `/tasks`;
    case "DakEntry":
      return `/dak`;
    case "Appointment":
      return `/appointments`;
    case "Hearing": {
      const caseUnitId = hearingCaseUnitId(meta);
      return caseUnitId ? `/cases/${caseUnitId}` : `/diary`;
    }
    case "Document":
      return null;
    default:
      return null;
  }
}

function hearingCaseUnitId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  if (typeof record.caseUnitId === "string") return record.caseUnitId;
  const after = record.after;
  if (after && typeof after === "object" && !Array.isArray(after)) {
    const caseUnitId = (after as Record<string, unknown>).caseUnitId;
    if (typeof caseUnitId === "string") return caseUnitId;
  }
  return null;
}

export const ENTITY_OPTIONS = [
  "Client",
  "Case",
  "User",
  "Document",
  "CashPayment",
  "Appointment",
  "OfficeTask",
  "DakEntry",
  "LeaveRequest",
  "OfficeHoliday",
  "Hearing",
] as const;
