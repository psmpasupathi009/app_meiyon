import type { Case, User } from "@prisma/client";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { toCaseSummary, type CaseSummary } from "@/features/cases/server/serialize";

/** Strip fee / internal fields for client portal responses. */
export type ClientCaseSummary = Omit<
  CaseSummary,
  "agreedFee" | "notes" | "filingChecklist" | "battaDue" | "awaitingService"
>;

export function toClientCaseSummary(item: Case): ClientCaseSummary {
  const full = toCaseSummary(item);
  const {
    agreedFee: _fee,
    notes: _notes,
    filingChecklist: _checklist,
    battaDue: _batta,
    awaitingService: _await,
    ...safe
  } = full;
  return safe;
}

export function assertOwnsClientUnit(
  user: {
    roles: User["roles"];
    clientUnitId?: string | null;
  },
  clientUnitId: string | null | undefined
): boolean {
  if (!isClientOnlyUser(user.roles)) return true;
  const cid = user.clientUnitId ?? null;
  return Boolean(cid && clientUnitId && cid === clientUnitId);
}

export function requireClientUnitId(
  user: Pick<User, "roles" | "clientUnitId"> | {
    roles: User["roles"];
    clientUnitId?: string | null;
  }
): string | null {
  if (!isClientOnlyUser(user.roles)) return null;
  return user.clientUnitId ?? null;
}
