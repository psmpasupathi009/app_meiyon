import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import {
  appointmentModeEnum,
  importAppointmentsSchema,
} from "@/lib/validations/appointments.schema";
import {
  canBookForAnyAdvocate,
  resolveBookingAdvocateMobile,
} from "@/lib/appointments/booking-rules";
import {
  caseBelongsToClient,
  findCaseByUnitId,
  findClientByUnitId,
} from "@/lib/imports/lookups";
import { IMPORT_APPOINTMENT_COLUMNS } from "@/lib/imports/columns";

export const POST = createImportHandler({
  perm: ["appointments", "create"],
  schema: importAppointmentsSchema,
  columns: IMPORT_APPOINTMENT_COLUMNS,
  audit: { action: "appointment.import", entity: "Appointment" },
  async processRows(rows, { user, dryRun }) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      const scheduledAt = new Date(row.scheduledAt.trim());
      if (Number.isNaN(scheduledAt.getTime())) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Invalid scheduledAt (use ISO or YYYY-MM-DDTHH:mm)",
        });
        continue;
      }

      let durationMin = 30;
      if (row.durationMin?.trim()) {
        const n = Number(row.durationMin);
        if (!Number.isFinite(n) || n < 5 || n > 480) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "durationMin must be 5–480",
          });
          continue;
        }
        durationMin = Math.round(n);
      }

      let mode: "office" | "call" | "video" = "office";
      if (row.mode?.trim()) {
        const modeParsed = appointmentModeEnum.safeParse(row.mode.trim());
        if (!modeParsed.success) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "mode must be office|call|video",
          });
          continue;
        }
        mode = modeParsed.data;
      }

      let clientId: string | undefined;
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
        clientId = client.id;
        clientUnitId = client.unitId;
      }

      let caseId: string | undefined;
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
        if (clientUnitId && !caseBelongsToClient(caseItem, clientUnitId)) {
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

      const resolved = resolveBookingAdvocateMobile({
        roles: user.roles,
        actorMobile: user.mobile,
        requestedMobile: row.advocateMobile,
      });
      if (!resolved.mobile) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: resolved.error ?? "Invalid advocateMobile",
        });
        continue;
      }

      if (canBookForAnyAdvocate(user.roles)) {
        const ten = resolved.mobile.replace(/\D/g, "").slice(-10);
        const advocate = await prisma.user.findFirst({
          where: {
            isActive: true,
            roles: { has: "advocate" },
            OR: [
              { mobile: resolved.mobile },
              { mobile: ten },
              { mobile: `91${ten}` },
            ],
          },
          select: { id: true },
        });
        if (!advocate) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "Advocate not found in office list",
          });
          continue;
        }
      }

      if (dryRun) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "ok" as const,
          message: "Will create (slot checks skipped on import)",
        });
        continue;
      }

      try {
        const unitId = await nextUnitId("appointment", user);
        const created = await prisma.appointment.create({
          data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
            unitId,
            clientId,
            clientUnitId,
            caseId,
            caseUnitId,
            advocateMobile: resolved.mobile,
            title: row.title,
            scheduledAt,
            durationMin,
            mode,
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
