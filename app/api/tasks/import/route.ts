import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import {
  importTasksSchema,
  officeTaskKindEnum,
} from "@/lib/validations/tasks.schema";
import { parseIstDateInput } from "@/lib/utils/ist";
import { notifyUser, scheduleNotify } from "@/lib/notifications/notify";
import { findCaseByUnitId, findUserByUnitId } from "@/lib/imports/lookups";
import { IMPORT_TASK_COLUMNS } from "@/lib/imports/columns";

export const POST = createImportHandler({
  perm: ["tasks", "create"],
  schema: importTasksSchema,
  columns: IMPORT_TASK_COLUMNS,
  audit: { action: "task.import", entity: "OfficeTask" },
  async processRows(rows, { user, dryRun }) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      const workDate = parseIstDateInput(row.workDate);
      if (!workDate) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: "Invalid workDate (use YYYY-MM-DD)",
        });
        continue;
      }

      let kind = "allotment";
      if (row.kind?.trim()) {
        const kindParsed = officeTaskKindEnum.safeParse(row.kind.trim());
        if (!kindParsed.success) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: `Invalid kind: ${row.kind}`,
          });
          continue;
        }
        kind = kindParsed.data;
      }

      let assigneeId: string | undefined;
      let assigneeUnitId: string | undefined;
      if (row.assigneeUnitId?.trim()) {
        const person = await findUserByUnitId(row.assigneeUnitId, user.officeId);
        if (!person) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: `Assignee not found: ${row.assigneeUnitId}`,
          });
          continue;
        }
        assigneeId = person.id;
        assigneeUnitId = person.unitId;
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

      if (dryRun) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "ok" as const,
          message: `Will create · ${kind} · ${row.workDate}`,
        });
        continue;
      }

      try {
        const unitId = await nextUnitId("officeTask", user);
        const created = await prisma.officeTask.create({
          data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
            unitId,
            title: row.title,
            kind,
            status: "open",
            workDate,
            assigneeUnitId,
            assigneeId,
            caseUnitId,
            createdById: user.id,
          },
        });

        if (assigneeId && assigneeId !== user.id && assigneeUnitId) {
          scheduleNotify(async () => {
            await notifyUser({
              officeId: user.officeId,
              officeUnitId: user.officeUnitId,
              userId: assigneeId!,
              userUnitId: assigneeUnitId!,
              type: "task_assigned",
              title: `Task assigned: ${created.title}`,
              body: null,
              href: "/tasks",
              meta: { taskUnitId: created.unitId },
            });
          });
        }

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
