import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { importPaymentsSchema } from "@/lib/validations/accounts.schema";
import { isPaymentPurpose } from "@/features/accounts/lib/payment-purposes";
import type { PaymentStatus, PaymentType } from "@prisma/client";
import {
  caseBelongsToClient,
  findCaseByUnitId,
  findClientByUnitId,
} from "@/lib/imports/lookups";
import { IMPORT_PAYMENT_COLUMNS } from "@/lib/imports/columns";
import { parseIstDateInput } from "@/lib/utils/ist";

const VALID_STATUS = new Set<PaymentStatus>(["pending", "paid"]);

/** Bulk import for opening balances — void is never allowed via CSV. */
export const POST = createImportHandler({
  perm: ["accounts", "upload"],
  schema: importPaymentsSchema,
  columns: IMPORT_PAYMENT_COLUMNS,
  audit: { action: "payment.import", entity: "CashPayment" },
  async processRows(rows, { user, dryRun }) {
    const results = [];
    const createdUnitIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      if (!isPaymentPurpose(row.type)) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Invalid payment type",
        });
        continue;
      }
      const type = row.type as PaymentType;
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Invalid amount",
        });
        continue;
      }
      if (type === "other" && !row.notes?.trim()) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Notes required for Other purpose",
        });
        continue;
      }

      try {
        const client = await findClientByUnitId(row.clientUnitId, user.officeId);
        if (!client) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "Client not found",
          });
          continue;
        }

        let caseUnitId: string | undefined;
        let caseId: string | undefined;
        if (row.caseUnitId?.trim()) {
          const caseItem = await findCaseByUnitId(row.caseUnitId, user.officeId);
          if (!caseItem) {
            results.push({
              row: rowNum,
              unitId: null,
              status: "error" as const,
              message: "Case not found",
            });
            continue;
          }
          if (!caseBelongsToClient(caseItem, client.unitId)) {
            results.push({
              row: rowNum,
              unitId: null,
              status: "error" as const,
              message: "Case does not belong to client",
            });
            continue;
          }
          caseId = caseItem.id;
          caseUnitId = caseItem.unitId;
        }

        let status: PaymentStatus = "pending";
        if (row.status?.trim()) {
          const rawStatus = row.status.trim().toLowerCase() as PaymentStatus;
          if (rawStatus === "void") {
            results.push({
              row: rowNum,
              unitId: null,
              status: "error" as const,
              message: "Void status not allowed via import",
            });
            continue;
          }
          if (!VALID_STATUS.has(rawStatus)) {
            results.push({
              row: rowNum,
              unitId: null,
              status: "error" as const,
              message: "Invalid status (use pending or paid)",
            });
            continue;
          }
          status = rawStatus;
        }

        const paidOn =
          status === "paid"
            ? row.paidOn?.trim()
              ? parseIstDateInput(row.paidOn)
              : null
            : null;
        if (status === "paid" && !paidOn) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "paidOn required when status is paid (YYYY-MM-DD)",
          });
          continue;
        }

        if (dryRun) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "ok" as const,
            message: "Will create",
          });
          continue;
        }

        const unitId = await nextUnitId("payment", user);
        const created = await prisma.cashPayment.create({
          data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
            unitId,
            clientId: client.id,
            clientUnitId: client.unitId,
            caseId,
            caseUnitId,
            type,
            amount,
            status,
            paidOn,
            notes: row.notes || undefined,
            createdById: user.id,
          },
        });

        createdUnitIds.push(created.unitId);
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

    return {
      results,
      auditMeta: { unitIds: createdUnitIds.slice(0, 100) },
    };
  },
});
