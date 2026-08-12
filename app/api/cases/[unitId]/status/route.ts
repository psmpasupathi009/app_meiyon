import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { updateCaseStatusSchema } from "@/lib/validations/cases.schema";
import { toCaseSummary } from "@/features/cases/server/serialize";
import {
  canTransitionStatus,
  normalizeCaseStatus,
} from "@meiyon/config";
import {
  findCaseNotifyRecipients,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId ? await prisma.case.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!item) return jsonFail("NOT_FOUND", "Case not found", 404);

  const raw = await request.json();
  const parsed = updateCaseStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  if (!canTransitionStatus(item.status, input.status)) {
    const from = normalizeCaseStatus(item.status);
    return jsonFail(
      "VALIDATION",
      `Cannot change status from ${from} to ${input.status}`,
      400
    );
  }

  const before = pickAuditFields(item as Record<string, unknown>, ["status"] as const);

  const updated = await prisma.case.update({
    where: { id: item.id },
    data: { status: input.status },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, ["status"] as const);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "case.status",
    entity: "Case",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  if (input.status === "filing_defect") {
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
            type: "filing_defect",
            title: `Filing defect: ${label}`,
            href: `/cases/${updated.unitId}`,
            meta: { caseUnitId: updated.unitId, status: updated.status },
          }))
      );
    });
  } else if (input.status !== item.status) {
    scheduleNotify(async () => {
      const recipients = await findCaseNotifyRecipients(user.officeId, [
        ...updated.advocateMobiles,
        updated.primaryAdvocateMobile,
      ]);
      const label =
        updated.caseNumber || updated.filingNumber || updated.unitId;
      const { CASE_STATUS_LABEL } = await import(
        "@meiyon/config"
      );
      const statusLabel =
        CASE_STATUS_LABEL[normalizeCaseStatus(updated.status)] ??
        updated.status;
      await notifyUsers(
        recipients
          .filter((u) => u.id !== user.id)
          .map((u) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: u.id,
            userUnitId: u.unitId,
            type: "case_status",
            title: `Case status: ${label}`,
            body: statusLabel,
            href: `/cases/${updated.unitId}`,
            meta: { caseUnitId: updated.unitId, status: updated.status },
          }))
      );
    });
  }

  return jsonOk({ case: toCaseSummary(updated) });
});
