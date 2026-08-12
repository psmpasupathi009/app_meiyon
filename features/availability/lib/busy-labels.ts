import { formatIstTime } from "@/lib/utils/ist";

const KIND_LABELS: Record<string, string> = {
  court: "Court",
  break: "Break",
  personal: "Personal",
  other: "Travel / site",
};

/** Human label for AdvocateTimeBlock.kind. */
export function blockKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/**
 * Label for booking busy segments (API busy[].label).
 * Prefer a free-text reason; otherwise a clear kind / appointment title.
 */
export function busySegmentLabel(input: {
  reason: string;
  label?: string | null;
  kind?: string | null;
}): string {
  const raw = (input.label ?? "").trim();
  if (input.reason === "leave") return raw || "Approved leave";
  if (input.reason === "closed") return raw || "Not working this day";
  if (input.reason === "appointment") return raw ? `Appointment · ${raw}` : "Appointment";
  if (input.reason === "block") {
    if (raw && !KIND_LABELS[raw]) return raw;
    const kind = input.kind ?? raw;
    if (kind === "court") return "In court";
    return blockKindLabel(kind || "other");
  }
  return raw || "Unavailable";
}

export type BusyTodayBlock = {
  kind: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

/** Compact presence-board chip text for today's time-away / appointment busy. */
export function summarizeBusyToday(blocks: BusyTodayBlock[]): string | null {
  if (blocks.length === 0) return null;
  if (blocks.length === 1) {
    const b = blocks[0]!;
    const start = formatIstTime(new Date(b.startsAt));
    const end = formatIstTime(new Date(b.endsAt));
    const kind =
      b.kind === "appointment"
        ? "Client meet"
        : blockKindLabel(b.kind);
    return `${kind} ${start}–${end}`;
  }
  return `Busy · ${blocks.length} blocks`;
}
