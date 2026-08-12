import { z } from "zod";

export const DOCUMENT_TYPES = [
  "judgment",
  "order",
  "pleading",
  "vakalatnama",
  "petition",
  "affidavit",
  "evidence",
  "id_proof",
  "receipt",
  "other",
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  judgment: "Judgment",
  order: "Order / interim order",
  pleading: "Pleading / written statement",
  vakalatnama: "Vakalatnama",
  petition: "Petition / plaint / complaint",
  affidavit: "Affidavit",
  evidence: "Evidence / annexure",
  id_proof: "ID / address proof",
  receipt: "Court / fee receipt",
  other: "Other",
};

export const documentUploadMetaSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    docType: z.enum(DOCUMENT_TYPES).default("other"),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    caseUnitId: z.string().trim().optional().or(z.literal("")),
    clientUnitId: z.string().trim().optional().or(z.literal("")),
    expenseUnitId: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (d) =>
      Boolean(d.caseUnitId?.trim()) ||
      Boolean(d.clientUnitId?.trim()) ||
      Boolean(d.expenseUnitId?.trim()),
    {
      message: "Link the document to a case, client, or expense",
      path: ["caseUnitId"],
    }
  );
