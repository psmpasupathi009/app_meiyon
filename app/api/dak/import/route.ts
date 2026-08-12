import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import {
  dakDirectionEnum,
  importDakSchema,
} from "@/lib/validations/dak.schema";
import { parseIstDateInput } from "@/lib/utils/ist";
import { findCaseByUnitId, findClientByUnitId } from "@/lib/imports/lookups";
import { IMPORT_DAK_COLUMNS } from "@/lib/imports/columns";

export const POST = createImportHandler({
  perm: ["dak", "create"],
  schema: importDakSchema,
  columns: IMPORT_DAK_COLUMNS,
  audit: { action: "dak.import", entity: "DakEntry" },
  async processRows(rows, { user, dryRun }) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      const directionParsed = dakDirectionEnum.safeParse(
        row.direction.trim().toLowerCase()
      );
      if (!directionParsed.success) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "direction must be in or out",
        });
        continue;
      }

      const entryDate = parseIstDateInput(row.entryDate);
      if (!entryDate) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Invalid entryDate (use YYYY-MM-DD)",
        });
        continue;
      }

      let caseUnitId: string | undefined;
      if (row.caseUnitId?.trim()) {
        const caseItem = await findCaseByUnitId(row.caseUnitId, user.officeId);
        if (!caseItem) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: `Case not found: ${row.caseUnitId}`,
          });
          continue;
        }
        caseUnitId = caseItem.unitId;
      }

      let clientUnitId: string | undefined;
      if (row.clientUnitId?.trim()) {
        const client = await findClientByUnitId(row.clientUnitId, user.officeId);
        if (!client) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: `Client not found: ${row.clientUnitId}`,
          });
          continue;
        }
        clientUnitId = client.unitId;
      }

      if (dryRun) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "ok" as const,
          message: `Will create · ${directionParsed.data}`,
        });
        continue;
      }

      try {
        const unitId = await nextUnitId("dak", user);
        const created = await prisma.dakEntry.create({
          data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
            unitId,
            direction: directionParsed.data,
            entryDate,
            subject: row.subject,
            fromTo: row.fromTo?.trim() || undefined,
            caseUnitId,
            clientUnitId,
            notes: row.notes?.trim() || undefined,
            createdById: user.id,
          },
        });
        results.push({
          row: rowNum,
          unitId: created.unitId,
          status: "ok" as const,
          message: "Created",
        });
      } catch {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Failed to save row",
        });
      }
    }

    return results;
  },
});
