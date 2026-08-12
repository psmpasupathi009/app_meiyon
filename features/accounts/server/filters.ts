import type { Prisma } from "@prisma/client";
import {
  isPaymentPurpose,
  type PaymentPurpose,
} from "@/features/accounts/lib/payment-purposes";

export type AccountsListFilters = {
  clientUnitId?: string;
  caseUnitId?: string;
  status?: string;
  type?: string;
  q?: string;
  from?: Date;
  to?: Date;
  matchingClientUnitIds?: string[];
};

const VALID_STATUS = new Set(["pending", "paid", "void"]);

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Build list/export where from URL search params. */
export function parseAccountsFilters(
  searchParams: URLSearchParams
): AccountsListFilters {
  // Prefer `purpose`; ignore export kinds passed as `type=accounts|cases`.
  const rawPurpose =
    searchParams.get("purpose")?.trim() ||
    searchParams.get("type")?.trim() ||
    undefined;
  const purpose =
    rawPurpose && rawPurpose !== "accounts" && rawPurpose !== "cases"
      ? rawPurpose
      : undefined;

  const status = searchParams.get("status")?.trim() || undefined;

  return {
    clientUnitId: searchParams.get("clientUnitId")?.trim() || undefined,
    caseUnitId: searchParams.get("caseUnitId")?.trim() || undefined,
    status: status && VALID_STATUS.has(status) ? status : undefined,
    type: purpose,
    q: searchParams.get("q")?.trim() || undefined,
    from: parseDateParam(searchParams.get("from")),
    to: parseDateParam(searchParams.get("to")),
  };
}

/**
 * Paid rows: window on paidOn.
 * Unpaid / pending / void (and paid with no paidOn): window on createdAt.
 */
function dateWindowWhere(
  from?: Date,
  to?: Date
): Prisma.CashPaymentWhereInput | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
  return {
    OR: [
      {
        AND: [
          { status: "paid" },
          { paidOn: { not: null } },
          { paidOn: range },
        ],
      },
      {
        AND: [
          {
            OR: [{ status: { not: "paid" } }, { paidOn: null }],
          },
          { createdAt: range },
        ],
      },
    ],
  };
}

export function buildAccountsWhere(
  filters: AccountsListFilters
): Prisma.CashPaymentWhereInput {
  const type =
    filters.type && isPaymentPurpose(filters.type)
      ? (filters.type as PaymentPurpose)
      : undefined;

  const and: Prisma.CashPaymentWhereInput[] = [];

  if (filters.clientUnitId) and.push({ clientUnitId: filters.clientUnitId });
  if (filters.caseUnitId) and.push({ caseUnitId: filters.caseUnitId });
  if (filters.status) and.push({ status: filters.status as never });
  if (type) and.push({ type });

  const dateWhere = dateWindowWhere(filters.from, filters.to);
  if (dateWhere) and.push(dateWhere);

  if (filters.q) {
    const q = filters.q;
    const or: Prisma.CashPaymentWhereInput[] = [
      { unitId: { contains: q } },
      { caseUnitId: { contains: q } },
      { notes: { contains: q } },
      { voidReason: { contains: q } },
      { clientUnitId: { contains: q } },
    ];
    if (filters.matchingClientUnitIds?.length) {
      or.push({ clientUnitId: { in: filters.matchingClientUnitIds } });
    }
    and.push({ OR: or });
  }

  return and.length ? { AND: and } : {};
}
