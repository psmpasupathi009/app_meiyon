import type { Prisma } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { FEE_PURPOSES } from "@/features/accounts/lib/payment-purposes";

export type FeeRollup = {
  agreedFee: number | null;
  collected: number;
  outstanding: number | null;
};

/** Paid fee-purpose totals for a case (excludes actuals and void). */
export async function feeRollupForCase(
  caseUnitId: string,
  extraWhere?: Prisma.CashPaymentWhereInput
): Promise<FeeRollup> {
  const caseItem = await prisma.case.findUnique({
    where: { unitId: caseUnitId },
    select: { agreedFee: true },
  });

  const where: Prisma.CashPaymentWhereInput = {
    caseUnitId,
    status: "paid",
    type: { in: [...FEE_PURPOSES] },
    ...extraWhere,
  };

  const agg = await prisma.cashPayment.aggregate({
    where,
    _sum: { amount: true },
  });

  const collected = agg._sum.amount ?? 0;
  const agreedFee = caseItem?.agreedFee ?? null;
  const outstanding =
    agreedFee != null ? Math.max(0, agreedFee - collected) : null;

  return { agreedFee, collected, outstanding };
}

/** Paid fee-purpose totals across all matters for a client. */
export async function feeRollupForClient(
  clientUnitId: string
): Promise<FeeRollup> {
  const cases = await prisma.case.findMany({
    where: { clientUnitId },
    select: { agreedFee: true },
  });

  const agg = await prisma.cashPayment.aggregate({
    where: {
      clientUnitId,
      status: "paid",
      type: { in: [...FEE_PURPOSES] },
    },
    _sum: { amount: true },
  });

  const collected = agg._sum.amount ?? 0;
  const agreedParts = cases
    .map((c) => c.agreedFee)
    .filter((n): n is number => n != null);
  const agreedFee =
    agreedParts.length > 0
      ? agreedParts.reduce((sum, n) => sum + n, 0)
      : null;
  const outstanding =
    agreedFee != null ? Math.max(0, agreedFee - collected) : null;

  return { agreedFee, collected, outstanding };
}
