import type { Attendance } from "@prisma/client";

export type AttendanceSummary = {
  unitId: string;
  userUnitId: string;
  userName: string | null;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracy: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracy: number | null;
  notes: string | null;
};

export function toAttendanceSummary(
  item: Attendance,
  userName?: string | null
): AttendanceSummary {
  return {
    unitId: item.unitId,
    userUnitId: item.userUnitId,
    userName: userName ?? null,
    date: item.date,
    checkInAt: item.checkInAt ? item.checkInAt.toISOString() : null,
    checkOutAt: item.checkOutAt ? item.checkOutAt.toISOString() : null,
    checkInLat: item.checkInLat ?? null,
    checkInLng: item.checkInLng ?? null,
    checkInAccuracy: item.checkInAccuracy ?? null,
    checkOutLat: item.checkOutLat ?? null,
    checkOutLng: item.checkOutLng ?? null,
    checkOutAccuracy: item.checkOutAccuracy ?? null,
    notes: item.notes,
  };
}

export type LeaveSummary = {
  unitId: string;
  userUnitId: string;
  userName: string | null;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: string;
  approvedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
};

export function toLeaveSummary(
  item: import("@prisma/client").LeaveRequest,
  userName?: string | null
): LeaveSummary {
  return {
    unitId: item.unitId,
    userUnitId: item.userUnitId,
    userName: userName ?? null,
    fromDate: item.fromDate,
    toDate: item.toDate,
    reason: item.reason,
    status: item.status,
    approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
    rejectReason: item.rejectReason,
    createdAt: item.createdAt.toISOString(),
  };
}
