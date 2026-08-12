/** Cash-register purposes aligned with legal.ts (fees + actuals extras). */

export const PAYMENT_PURPOSES = [
  "advance",
  "partial",
  "full",
  "consultation",
  "court_fee",
  "stamp",
  "copying",
  "travel",
  "clerkage",
  "other",
] as const;

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/** Count toward agreed fee vs collected (exclude actuals). */
export const FEE_PURPOSES: readonly PaymentPurpose[] = [
  "advance",
  "partial",
  "full",
  "consultation",
] as const;

export const ACTUALS_PURPOSES: readonly PaymentPurpose[] = [
  "court_fee",
  "stamp",
  "copying",
  "travel",
  "clerkage",
  "other",
] as const;

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  advance: "Advance",
  partial: "Stage / partial",
  full: "Full / final",
  consultation: "Consultation",
  court_fee: "Court fee",
  stamp: "Stamp",
  copying: "Copying",
  travel: "Travel",
  clerkage: "Clerkage",
  other: "Other",
};

export const PAYMENT_PURPOSE_OPTIONS = PAYMENT_PURPOSES.map((value) => ({
  value,
  label: PAYMENT_PURPOSE_LABELS[value],
}));

export function isFeePurpose(type: string): boolean {
  return (FEE_PURPOSES as readonly string[]).includes(type);
}

export function isPaymentPurpose(value: string): value is PaymentPurpose {
  return (PAYMENT_PURPOSES as readonly string[]).includes(value);
}
