export const EXPENSE_CATEGORIES = [
  "stationery",
  "utilities",
  "maintenance",
  "travel",
  "refreshments",
  "equipment",
  "professional_services",
  "misc",
  "others",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  stationery: "Stationery",
  utilities: "Utilities",
  maintenance: "Maintenance",
  travel: "Travel",
  refreshments: "Refreshments",
  equipment: "Equipment",
  professional_services: "Professional services",
  misc: "Miscellaneous",
  others: "Others",
};

export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export const EXPENSE_PAYMENT_MODES = [
  "cash",
  "upi",
  "card",
  "bank",
  "other",
] as const;

export type ExpensePaymentModeValue = (typeof EXPENSE_PAYMENT_MODES)[number];

export const EXPENSE_PAYMENT_MODE_LABELS: Record<
  ExpensePaymentModeValue,
  string
> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
};

export const EXPENSE_PAYMENT_MODE_OPTIONS = EXPENSE_PAYMENT_MODES.map(
  (value) => ({
    value,
    label: EXPENSE_PAYMENT_MODE_LABELS[value],
  })
);

export function isExpensePaymentMode(
  value: string
): value is ExpensePaymentModeValue {
  return (EXPENSE_PAYMENT_MODES as readonly string[]).includes(value);
}
