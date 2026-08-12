import { prisma } from "@meiyon/db";
import type { BillingCycle } from "@prisma/client";

export async function nextInvoiceUnitId(): Promise<string> {
  const counter = await prisma.platformIdCounter.upsert({
    where: { entity: "INV" },
    create: { entity: "INV", seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `INV-${String(counter.seq).padStart(5, "0")}`;
}

export type CreateInvoiceInput = {
  officeId: string;
  officeUnitId: string;
  subscriptionId?: string;
  amountPaise: number;
  taxPaise?: number;
  razorpayPaymentId?: string;
  status?: "draft" | "paid" | "void";
};

export async function createInvoiceRecord(input: CreateInvoiceInput) {
  const unitId = await nextInvoiceUnitId();
  return prisma.invoice.create({
    data: {
      unitId,
      officeId: input.officeId,
      officeUnitId: input.officeUnitId,
      subscriptionId: input.subscriptionId,
      amountPaise: input.amountPaise,
      taxPaise: input.taxPaise ?? Math.round(input.amountPaise * 0.18),
      status: input.status ?? "paid",
      razorpayPaymentId: input.razorpayPaymentId,
      paidAt: input.status === "void" ? undefined : new Date(),
    },
  });
}

export function addBillingPeriod(from: Date, cycle: BillingCycle): Date {
  const end = new Date(from);
  if (cycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export function computeGstPaise(amountPaise: number): number {
  return Math.round(amountPaise * 0.18);
}
