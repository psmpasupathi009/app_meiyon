import { prisma } from "@meiyon/db";
import type { BillingCycle } from "@prisma/client";

export const GST_RATE = 0.18;
export const SAC_SAAS = "998314";
export const SUPPLIER_STATE_CODE = (
  process.env.SUPPLIER_STATE_CODE ?? "33"
).trim();

export function computeGstPaise(amountPaise: number): number {
  return Math.round(amountPaise * GST_RATE);
}

export function gstInclusivePaise(amountPaise: number): number {
  return amountPaise + computeGstPaise(amountPaise);
}

export function gstSplit(taxablePaise: number, buyerState?: string | null) {
  const tax = computeGstPaise(taxablePaise);
  const s = (buyerState ?? "").trim().toLowerCase();
  const intra =
    !s ||
    s.includes("tamil") ||
    s === "tn" ||
    s.startsWith("33") ||
    s === SUPPLIER_STATE_CODE.toLowerCase();
  if (intra) {
    const half = Math.round(tax / 2);
    return { cgstPaise: half, sgstPaise: tax - half, igstPaise: 0, taxPaise: tax };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: tax, taxPaise: tax };
}

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
  buyerGstin?: string | null;
  buyerState?: string | null;
};

export async function createInvoiceRecord(input: CreateInvoiceInput) {
  const office = await prisma.office.findUnique({
    where: { id: input.officeId },
    select: { gstin: true, state: true },
  });
  const split = gstSplit(
    input.amountPaise,
    office?.state ?? input.buyerState
  );
  const unitId = await nextInvoiceUnitId();
  return prisma.invoice.create({
    data: {
      unitId,
      officeId: input.officeId,
      officeUnitId: input.officeUnitId,
      subscriptionId: input.subscriptionId,
      amountPaise: input.amountPaise,
      taxPaise: input.taxPaise ?? split.taxPaise,
      cgstPaise: split.cgstPaise,
      sgstPaise: split.sgstPaise,
      igstPaise: split.igstPaise,
      sac: SAC_SAAS,
      supplierGstin: process.env.SUPPLIER_GSTIN?.trim() || null,
      buyerGstin: input.buyerGstin ?? office?.gstin ?? null,
      placeOfSupply: office?.state ?? input.buyerState ?? "Tamil Nadu",
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
