import type { OfficeExpense } from "@prisma/client";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_MODE_LABELS,
  type ExpenseCategory,
  type ExpensePaymentModeValue,
} from "@/features/expenses/lib/categories";

export type ExpenseActor = {
  unitId: string;
  name: string | null;
};

export type ExpenseSummary = {
  unitId: string;
  expenseDate: string;
  category: string;
  categoryLabel: string;
  vendor: string | null;
  description: string;
  amount: number;
  paymentMode: string;
  paymentModeLabel: string;
  billDocumentUnitId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: ExpenseActor | null;
  voidedBy: ExpenseActor | null;
};

export function categoryLabel(category: string): string {
  return (
    EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ??
    category.replaceAll("_", " ")
  );
}

export function paymentModeLabel(mode: string): string {
  return (
    EXPENSE_PAYMENT_MODE_LABELS[mode as ExpensePaymentModeValue] ??
    mode.replaceAll("_", " ")
  );
}

export function toExpenseSummary(
  item: OfficeExpense,
  actors?: {
    createdBy?: ExpenseActor | null;
    voidedBy?: ExpenseActor | null;
  }
): ExpenseSummary {
  return {
    unitId: item.unitId,
    expenseDate: item.expenseDate.toISOString(),
    category: item.category,
    categoryLabel: categoryLabel(item.category),
    vendor: item.vendor,
    description: item.description,
    amount: item.amount,
    paymentMode: item.paymentMode,
    paymentModeLabel: paymentModeLabel(item.paymentMode),
    billDocumentUnitId: item.billDocumentUnitId,
    voidedAt: item.voidedAt ? item.voidedAt.toISOString() : null,
    voidReason: item.voidReason,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: actors?.createdBy ?? null,
    voidedBy: actors?.voidedBy ?? null,
  };
}
