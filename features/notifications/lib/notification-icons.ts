import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Gavel,
  Landmark,
  Plane,
  Scale,
  UserCheck,
} from "lucide-react";

const TYPE_ICONS: Record<string, LucideIcon> = {
  leave_request: Plane,
  leave_decided: UserCheck,
  leave_cancelled: Plane,
  task_assigned: ClipboardList,
  task_done: CheckCircle2,
  appointment: Calendar,
  appointment_updated: Calendar,
  appointment_cancelled: Calendar,
  case_status: Briefcase,
  case_created: Briefcase,
  filing_defect: FileWarning,
  batta_due: Landmark,
  hearing_tomorrow: Gavel,
  hearing_adjourned: Gavel,
  office_holiday: Calendar,
  dak_received: ClipboardList,
  document_uploaded: FileWarning,
  payment_recorded: Landmark,
  payment_voided: Landmark,
  employee_deactivated: UserCheck,
  system: Scale,
};

export function typeIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? Bell;
}
