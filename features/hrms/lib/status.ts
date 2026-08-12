/** Date ranges overlap when each starts on/before the other ends (YYYY-MM-DD). */
export function dateRangesOverlap(
  fromA: string,
  toA: string,
  fromB: string,
  toB: string
): boolean {
  return fromA <= toB && fromB <= toA;
}

export function leaveCoversDate(
  fromDate: string,
  toDate: string,
  dateKey: string
): boolean {
  return fromDate <= dateKey && toDate >= dateKey;
}

export type PresenceStatus = "absent" | "in" | "out" | "on_leave";

/** Derive board status: approved leave wins over check-in/out. */
export function derivePresenceStatus(input: {
  onApprovedLeave: boolean;
  checkInAt: Date | string | null | undefined;
  checkOutAt: Date | string | null | undefined;
}): PresenceStatus {
  if (input.onApprovedLeave) return "on_leave";
  if (input.checkOutAt) return "out";
  if (input.checkInAt) return "in";
  return "absent";
}
