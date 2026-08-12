import type { Prisma } from "@prisma/client";
import {
  isExpenseCategory,
  type ExpenseCategory,
} from "@/features/expenses/lib/categories";
import { containsInsensitive } from "@/lib/db/search";

export type ExpensesListFilters = {
  category?: string;
  q?: string;
  from?: Date;
  to?: Date;
  /** active (default) | void | all */
  status?: "active" | "void" | "all";
};

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Build list/export where from URL search params. */
export function parseExpensesFilters(
  searchParams: URLSearchParams
): ExpensesListFilters {
  const rawStatus = searchParams.get("status")?.trim();
  const status =
    rawStatus === "void" || rawStatus === "all" || rawStatus === "active"
      ? rawStatus
      : "active";

  return {
    category: searchParams.get("category")?.trim() || undefined,
    q: searchParams.get("q")?.trim() || undefined,
    from: parseDateParam(searchParams.get("from")),
    to: parseDateParam(searchParams.get("to")),
    status,
  };
}

export function buildExpensesWhere(
  filters: ExpensesListFilters
): Prisma.OfficeExpenseWhereInput {
  const and: Prisma.OfficeExpenseWhereInput[] = [];

  if (filters.status === "void") {
    and.push({ voidedAt: { not: null } });
  } else if (filters.status !== "all") {
    and.push({ voidedAt: null });
  }

  if (filters.category && isExpenseCategory(filters.category)) {
    and.push({ category: filters.category as ExpenseCategory });
  }

  if (filters.from || filters.to) {
    and.push({
      expenseDate: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { unitId: containsInsensitive(q) },
        { vendor: containsInsensitive(q) },
        { description: containsInsensitive(q) },
        { voidReason: containsInsensitive(q) },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

/** Where for summary totals — always exclude voided. */
export function buildExpensesSummaryWhere(
  filters: ExpensesListFilters
): Prisma.OfficeExpenseWhereInput {
  return buildExpensesWhere({ ...filters, status: "active" });
}
