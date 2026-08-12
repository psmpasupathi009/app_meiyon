import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { normalizeMobile } from "@/lib/auth/mobile";
import { importClientsSchema } from "@/lib/validations/clients.schema";
import {
  findClientByMobile,
  findClientByUnitId,
} from "@/lib/imports/lookups";
import { IMPORT_CLIENT_COLUMNS } from "@/lib/imports/columns";

export const POST = createImportHandler({
  perm: ["clients", "create"],
  editPerm: ["clients", "edit"],
  schema: importClientsSchema,
  columns: IMPORT_CLIENT_COLUMNS,
  audit: { action: "client.import", entity: "Client" },
  async processRows(rows, { user, dryRun, canEdit }) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      const mobile = normalizeMobile(row.mobile);
      if (!mobile) {
        results.push({
          row: rowNum,
          unitId: row.unitId || null,
          status: "error" as const,
          message: "Invalid mobile number",
        });
        continue;
      }

      try {
        const existingByUnitId = row.unitId
          ? await findClientByUnitId(row.unitId, user.officeId)
          : null;
        const existingByMobile = await findClientByMobile(mobile, user.officeId);

        if (row.unitId?.trim() && !existingByUnitId) {
          results.push({
            row: rowNum,
            unitId: row.unitId,
            status: "error" as const,
            message:
              "Client unitId not found (remove unitId to create a new client)",
          });
          continue;
        }

        if (
          existingByUnitId &&
          existingByUnitId.mobile !== mobile &&
          existingByMobile
        ) {
          results.push({
            row: rowNum,
            unitId: row.unitId || null,
            status: "error" as const,
            message: "Mobile already used by another client",
          });
          continue;
        }

        if (!existingByUnitId && existingByMobile) {
          results.push({
            row: rowNum,
            unitId: existingByMobile.unitId,
            status: "error" as const,
            message:
              "Mobile already registered (set unitId to update that client)",
          });
          continue;
        }

        if (existingByUnitId && !canEdit) {
          results.push({
            row: rowNum,
            unitId: existingByUnitId.unitId,
            status: "error" as const,
            message: "Updating existing clients requires clients.edit",
          });
          continue;
        }

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
          const updated = await prisma.client.update({
            where: { id: existingByUnitId.id },
            data: { name: row.name, mobile },
          });
          results.push({
            row: rowNum,
            unitId: updated.unitId,
            status: "ok" as const,
            message: "Updated",
          });
        } else {
          const unitId = await nextUnitId("client", user);
          const created = await prisma.client.create({
            data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
              unitId,
              name: row.name,
              mobile,
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
