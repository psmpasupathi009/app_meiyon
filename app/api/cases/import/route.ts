import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { normalizeMobile } from "@/lib/auth/mobile";
import { importCasesSchema } from "@/lib/validations/cases.schema";
import type { CaseStatus } from "@prisma/client";
import {
  CASE_PIPELINE_STATUSES,
  normalizeCaseStatus,
} from "@meiyon/config";
import { parseIstDateInput } from "@/lib/utils/ist";
import { findCaseByUnitId, findClientByUnitId } from "@/lib/imports/lookups";
import { IMPORT_CASE_COLUMNS } from "@/lib/imports/columns";

const VALID_STATUS = new Set<string>([
  ...CASE_PIPELINE_STATUSES,
  "pending",
  "listed",
]);

export const POST = createImportHandler({
  perm: ["cases", "upload"],
  editPerm: ["cases", "edit"],
  schema: importCasesSchema,
  columns: IMPORT_CASE_COLUMNS,
  audit: { action: "case.import", entity: "Case" },
  async processRows(rows, { user, dryRun, canEdit }) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      try {
        const client = await findClientByUnitId(row.clientUnitId, user.officeId);
        if (!client) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "error" as const,
            message: "Client not found (set clientUnitId)",
          });
          continue;
        }

        if (row.caseNumber) {
          const dupe = await prisma.case.findFirst({
            where: { caseNumber: row.caseNumber },
            select: { unitId: true },
          });
          if (dupe && dupe.unitId !== row.unitId) {
            results.push({
              row: rowNum,
              unitId: row.unitId || null,
              status: "error" as const,
              message: "Case number already exists",
            });
            continue;
          }
        }

        const existingByUnitId = row.unitId
          ? await findCaseByUnitId(row.unitId, user.officeId)
          : null;

        if (row.unitId?.trim() && !existingByUnitId) {
          results.push({
            row: rowNum,
            unitId: row.unitId,
            status: "error" as const,
            message:
              "Case unitId not found (remove unitId to create a new case)",
          });
          continue;
        }

        if (existingByUnitId && !canEdit) {
          results.push({
            row: rowNum,
            unitId: existingByUnitId.unitId,
            status: "error" as const,
            message: "Updating existing cases requires cases.edit",
          });
          continue;
        }

        if (row.status?.trim() && !VALID_STATUS.has(row.status.trim())) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "error" as const,
            message: `Invalid status: ${row.status}`,
          });
          continue;
        }

        const status: CaseStatus = row.status?.trim()
          ? (normalizeCaseStatus(row.status.trim()) as CaseStatus)
          : "enquiry";

        const filingDate = row.filingDate?.trim()
          ? parseIstDateInput(row.filingDate)
          : undefined;
        if (row.filingDate?.trim() && filingDate === null) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "error" as const,
            message: "Invalid filingDate (use YYYY-MM-DD)",
          });
          continue;
        }

        const nextHearingAt = row.nextHearingAt?.trim()
          ? parseIstDateInput(row.nextHearingAt)
          : undefined;
        if (row.nextHearingAt?.trim() && nextHearingAt === null) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "error" as const,
            message: "Invalid nextHearingAt (use YYYY-MM-DD)",
          });
          continue;
        }

        let agreedFee: number | undefined;
        if (row.agreedFee?.trim()) {
          agreedFee = Number(row.agreedFee);
          if (!Number.isFinite(agreedFee)) {
            results.push({
              row: rowNum,
              unitId: row.unitId || null,
              status: "error" as const,
              message: "Invalid agreedFee",
            });
            continue;
          }
        }

        const primaryAdvocateMobile = row.primaryAdvocateMobile?.trim()
          ? normalizeMobile(row.primaryAdvocateMobile) ??
            row.primaryAdvocateMobile.trim()
          : undefined;

        const sharedData = {
          clientId: client.id,
          clientUnitId: client.unitId,
          caseNumber: row.caseNumber || undefined,
          cnr: row.cnr || undefined,
          courtName: row.courtName || undefined,
          primaryAdvocateMobile,
          advocateMobiles: primaryAdvocateMobile ? [primaryAdvocateMobile] : [],
          caseType: row.caseType || undefined,
          status,
          filingDate: filingDate ?? undefined,
          nextHearingAt: nextHearingAt ?? undefined,
          agreedFee,
          notes: row.notes || undefined,
        };

        if (dryRun) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "ok" as const,
            message: existingByUnitId ? "Will update" : "Will create",
          });
          continue;
        }

        if (existingByUnitId) {
          const updated = await prisma.case.update({
            where: { id: existingByUnitId.id },
            data: sharedData,
          });
          results.push({
            row: rowNum,
            unitId: updated.unitId,
            status: "ok" as const,
            message: "Updated",
          });
        } else {
          const unitId = await nextUnitId("case", user);
          const created = await prisma.case.create({
            data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
              unitId,
              ...sharedData,
              createdById: user.id,
            },
          });
          results.push({
            row: rowNum,
            unitId: created.unitId,
            status: "ok" as const,
            message: "Created",
          });
        }
      } catch {
        results.push({
          row: rowNum,
          unitId: row.unitId || null,
          status: "error" as const,
          message: "Failed to save row",
        });
      }
    }

    return results;
  },
});
