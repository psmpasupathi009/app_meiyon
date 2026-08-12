import type { DakEntry } from "@prisma/client";
import { istDateKey } from "@/lib/utils/ist";

export type DakSummary = {
  unitId: string;
  direction: string;
  entryDate: string;
  entryDateKey: string;
  subject: string;
  fromTo: string | null;
  mode: string | null;
  trackingNo: string | null;
  caseUnitId: string | null;
  caseNumber: string | null;
  clientUnitId: string | null;
  clientName: string | null;
  notes: string | null;
  createdAt: string;
};

export function toDakSummary(
  item: DakEntry,
  extras?: { caseNumber?: string | null; clientName?: string | null }
): DakSummary {
  return {
    unitId: item.unitId,
    direction: item.direction,
    entryDate: item.entryDate.toISOString(),
    entryDateKey: istDateKey(item.entryDate),
    subject: item.subject,
    fromTo: item.fromTo,
    mode: item.mode,
    trackingNo: item.trackingNo,
    caseUnitId: item.caseUnitId,
    caseNumber: extras?.caseNumber ?? null,
    clientUnitId: item.clientUnitId,
    clientName: extras?.clientName ?? null,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
  };
}
