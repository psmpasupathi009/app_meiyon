import type { PaymentSummary } from "@/features/accounts/server/serialize";
import type { PeriodPreset } from "@/features/accounts/lib/period";

export type PaymentRow = PaymentSummary & { clientName: string | null };

export type FeeSummary = {
  agreedFee: number | null;
  collected: number;
  outstanding: number | null;
};

export type ListResponse = {
  data: PaymentRow[];
  meta: { page: number; pageSize: number; total: number };
  summary: {
    paid: number;
    pending: number;
    void: number;
    netCollected: number;
    entryCount: number;
  };
  fee: FeeSummary | null;
};

export const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "muted"
> = {
  pending: "warning",
  paid: "success",
  void: "muted",
};

export const PERIOD_CHIPS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "month", label: "This month" },
  { id: "fy", label: "This FY" },
  { id: "custom", label: "Custom range" },
];

export const STATUS_CHIPS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "void", label: "Void" },
];

export function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function truncate(s: string | null, n = 40) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
