import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { updateFilingChecklistSchema } from "@/lib/validations/cases.schema";
import { toCaseSummary } from "@/features/cases/server/serialize";
import {
  normalizeCaseStatus,
  PRE_NUMBER_STATUSES,
  type FilingChecklistState,
} from "@meiyon/config";
import {
  findCaseNotifyRecipients,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

function parseChecklist(raw: Prisma.JsonValue | null | undefined): FilingChecklistState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as FilingChecklistState;
}

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId ? await prisma.case.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!item) return jsonFail("NOT_FOUND", "Case not found", 404);

  const raw = await request.json();
  const parsed = updateFilingChecklistSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const checklist: FilingChecklistState = {
    ...parseChecklist(item.filingChecklist),
    ...input.filingChecklist,
  };

  const data: Prisma.CaseUpdateInput = {
    filingChecklist: checklist as Prisma.InputJsonValue,
    ...(input.battaDue !== undefined ? { battaDue: input.battaDue } : {}),
    ...(input.awaitingService !== undefined
      ? { awaitingService: input.awaitingService }
      : {}),
  };

  const hasNumber = Boolean(item.caseNumber || item.cnr);
  const status = normalizeCaseStatus(item.status);
  if (
    input.promoteIfNumbered &&
    hasNumber &&
    PRE_NUMBER_STATUSES.includes(status)
  ) {
    data.status = "active";
    checklist.numbered = true;
    data.filingChecklist = checklist as Prisma.InputJsonValue;
  }

  const updated = await prisma.case.update({
    where: { id: item.id },
    data,
  });

  if (input.battaDue === true && !item.battaDue) {
    scheduleNotify(async () => {
      const recipients = await findCaseNotifyRecipients(user.officeId, [
        ...updated.advocateMobiles,
        updated.primaryAdvocateMobile,
      ]);
      const label =
        updated.caseNumber || updated.filingNumber || updated.unitId;
      await notifyUsers(
        recipients
          .filter((u) => u.id !== user.id)
          .map((u) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: u.id,
            userUnitId: u.unitId,
            type: "batta_due",
            title: `Batta due: ${label}`,
            href: `/cases/${updated.unitId}`,
            meta: { caseUnitId: updated.unitId },
          }))
      );
    });
  }

  return jsonOk({ case: toCaseSummary(updated) });
});
