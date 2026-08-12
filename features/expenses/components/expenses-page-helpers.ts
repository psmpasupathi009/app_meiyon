import type { ExpenseSummary } from "@/features/expenses/server/serialize";
import type { ExpensePeriodPreset } from "@/features/expenses/lib/period";

export type ExpenseRow = ExpenseSummary;

export type ListResponse = {
  data: ExpenseRow[];
  meta: { page: number; pageSize: number; total: number };
  summary: {
    totalAmount: number;
    entryCount: number;
  };
};

export const PERIOD_CHIPS: { id: ExpensePeriodPreset; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom range" },
];

export const STATUS_CHIPS: { id: string; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "void", label: "Void" },
  { id: "all", label: "All" },
];

export function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function truncate(s: string | null, n = 40) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
