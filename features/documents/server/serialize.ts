import type { Document } from "@prisma/client";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentTypeValue,
} from "@/lib/validations/documents.schema";

export type DocumentSummary = {
  unitId: string;
  title: string;
  docType: DocumentTypeValue;
  docTypeLabel: string;
  notes: string | null;
  caseUnitId: string | null;
  clientUnitId: string | null;
  expenseUnitId: string | null;
  mimeType: string;
  size: number;
  originalName: string;
  createdAt: string;
};

export function toDocumentSummary(doc: Document): DocumentSummary {
  const docType = (doc.docType ?? "other") as DocumentTypeValue;
  return {
    unitId: doc.unitId,
    title: doc.title,
    docType,
    docTypeLabel: DOCUMENT_TYPE_LABELS[docType] ?? "Other",
    notes: doc.notes ?? null,
    caseUnitId: doc.caseUnitId,
    clientUnitId: doc.clientUnitId,
    expenseUnitId: doc.expenseUnitId ?? null,
    mimeType: doc.mimeType,
    size: doc.size,
    originalName: doc.originalName,
    createdAt: doc.createdAt.toISOString(),
  };
}
