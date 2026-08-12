import type { CashPayment } from "@prisma/client";
import {
  PAYMENT_PURPOSE_LABELS,
  type PaymentPurpose,
} from "@/features/accounts/lib/payment-purposes";

export type PaymentActor = {
  unitId: string;
  name: string | null;
};

export type PaymentSummary = {
  unitId: string;
  clientUnitId: string;
  caseUnitId: string | null;
  type: string;
  typeLabel: string;
  amount: number;
  status: string;
  paidOn: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: PaymentActor | null;
  voidedBy: PaymentActor | null;
};

export function purposeLabel(type: string): string {
  return PAYMENT_PURPOSE_LABELS[type as PaymentPurpose] ?? type;
}

export function toPaymentSummary(
  item: CashPayment,
  actors?: {
    createdBy?: PaymentActor | null;
    voidedBy?: PaymentActor | null;
  }
): PaymentSummary {
  return {
    unitId: item.unitId,
    clientUnitId: item.clientUnitId,
    caseUnitId: item.caseUnitId,
    type: item.type,
    typeLabel: purposeLabel(item.type),
    amount: item.amount,
    status: item.status,
    paidOn: item.paidOn ? item.paidOn.toISOString() : null,
    notes: item.notes,
    voidedAt: item.voidedAt ? item.voidedAt.toISOString() : null,
    voidReason: item.voidReason,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: actors?.createdBy ?? null,
    voidedBy: actors?.voidedBy ?? null,
  };
}
