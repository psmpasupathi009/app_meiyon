import type { ComponentType, ReactNode } from "react";

export type TodayHearing = {
  caseUnitId: string;
  caseNumber: string | null;
  caseType?: string | null;
  courtName: string | null;
  district: string | null;
  status: string;
  nextHearingAt: string | null;
  clientName: string;
  clientUnitId: string;
  clientMobile: string | null;
  advocateName?: string | null;
  advocateMobile?: string | null;
};

export type TodayAppointment = {
  unitId: string;
  title: string;
  scheduledAt: string;
  timeLabel: string;
  durationMin: number;
  mode: string;
  location: string | null;
  notes: string | null;
  clientName: string | null;
  clientUnitId: string | null;
  clientMobile: string | null;
  advocateName: string | null;
  advocateMobile: string | null;
  advocateUnitId?: string | null;
  advocatePhotoUrl?: string | null;
};

export type AdvocateLoad = {
  mobile: string;
  name: string;
  today: number;
  week: number;
};

export type AdminStaffPresence = {
  unitId: string;
  name: string;
  mobile: string | null;
  photoUrl?: string | null;
  checkedIn: boolean;
  checkedOut: boolean;
  status?: "absent" | "in" | "out" | "on_leave";
  notes?: string | null;
  busyToday?: {
    kind: string;
    startsAt: string;
    endsAt: string;
    reason: string | null;
  }[];
};

export type AttentionItem = {
  label: string;
  value: string;
  href: string;
  cta: string;
  tone: "warning" | "danger" | "info";
};

export type DashboardSummary = {
  todayKey?: string;
  isOfficeAdmin?: boolean;
  employees?: { total: number; active: number; advocates?: number };
  clients?: { total: number };
  cases?: {
    total: number;
    pending: number;
    listed: number;
    open: number;
    active?: number;
    weekHearings: number;
    missingCourtNumber: number;
    battaDue?: number;
    filingDefect?: number;
    tomorrowHearings?: number;
    todayHearings: TodayHearing[];
  };
  accounts?: {
    pendingAmount: number;
    pendingCount: number;
    paidThisMonth: number;
  };
  appointments?: {
    today: number;
    week: number;
    todayList: TodayAppointment[];
    weekList?: TodayAppointment[];
    byAdvocate: AdvocateLoad[];
  };
  hrms?: {
    checkedInToday: boolean;
    checkedOutToday: boolean;
    onApprovedLeaveToday?: boolean;
    officeHolidayToday?: { title: string; notes: string | null } | null;
    pendingLeaveApprovals: number | null;
  };
  adminBoard?: {
    staff?: AdminStaffPresence[];
    advocates: AdminStaffPresence[];
    counts?: {
      total: number;
      present: number;
      out: number;
      onLeave: number;
      absent: number;
    };
    checkedInCount: number;
    advocateCount: number;
    officeHoliday?: { title: string; notes: string | null } | null;
  };
  attention?: AttentionItem[];
};

export type DayKindFilter = "all" | "appointments" | "hearings";

export type TimelineRow = {
  key: string;
  kind: "appointment" | "hearing";
  sortAt: number;
  timeLabel: string;
  title: string;
  href: string;
  client: string;
  advocate: ReactNode;
  advocateLabel: string;
  detail: string;
  refId: string;
  advocateMobile: string | null;
};

export type MetricItem = {
  label: string;
  value: string;
  hint?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export type OfficePresenceRow = {
  key: string;
  name: string;
  mobile: string | null;
  photoUrl?: string | null;
  status: "absent" | "in" | "out" | "on_leave" | "unknown";
  showAttendance: boolean;
  busyLabel: string | null;
};

export type OfficePresenceData = {
  rows: OfficePresenceRow[];
  presenceStats: {
    absent: number;
    present: number;
    out: number;
    onLeave: number;
  };
  busyPeople: OfficePresenceRow[];
};

export function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function tenDigits(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  const d = mobile.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("91")) return d.slice(-10);
  if (d.length === 10) return d;
  return d.slice(-10) || null;
}

export function greetingLabel(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(date)
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatTodayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatHearingTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
