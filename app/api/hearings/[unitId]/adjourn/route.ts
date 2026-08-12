import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { adjournHearingSchema } from "@/lib/validations/cases.schema";
import { toHearingSummary } from "@/features/cases/server/serialize";
import {
  findCaseNotifyRecipients,
  isHearingWithinNextIstDays,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";
import { istDisplayDate } from "@/lib/utils/ist";
import {
  assertAdvocateCourtDayAvailable,
  clashMessage,
} from "@/lib/hearings/advocate-day";

export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const hearing = unitId
    ? await prisma.hearing.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!hearing) return jsonFail("NOT_FOUND", "Hearing not found", 404);
  if (hearing.isAdjourned) {
    return jsonFail("CONFLICT", "This hearing is already adjourned", 409);
  }

  const raw = await request.json();
  const parsed = adjournHearingSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const caseItem = await prisma.case.findUnique({
    where: { id: hearing.caseId },
  });
  if (!caseItem) return jsonFail("NOT_FOUND", "Case not found", 404);

  // Next hearing uses the case primary advocate.
  const nextAdvocate = caseItem.primaryAdvocateMobile;
  if (nextAdvocate) {
    const clash = await assertAdvocateCourtDayAvailable({
      officeId: user.officeId,
      advocateMobile: nextAdvocate,
      hearingDate: input.nextHearingDate,
      court: caseItem,
      excludeHearingId: hearing.id,
    });
    if (!clash.ok) {
      return jsonFail(
        "CONFLICT",
        `${clashMessage(clash)}. Reassign the case primary advocate, or pick another date.`,
        409
      );
    }
  }

  const hearingBefore = pickAuditFields(hearing as Record<string, unknown>, [
    "hearingDate",
    "isAdjourned",
    "outcome",
    "notes",
    "caseUnitId",
  ] as const);

  const nextHearingUnitId = await nextUnitId("hearing", user);

  const [adjournedHearing, nextHearing] = await prisma.$transaction([
    prisma.hearing.update({
      where: { id: hearing.id },
      data: {
        isAdjourned: true,
        outcome: input.outcome || "Adjourned",
        notes: input.notes || undefined,
      },
    }),
    prisma.hearing.create({
      data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
        unitId: nextHearingUnitId,
        caseId: hearing.caseId,
        caseUnitId: hearing.caseUnitId,
        hearingDate: input.nextHearingDate,
        purpose: "Adjourned hearing",
        createdById: user.id,
      },
    }),
    prisma.case.update({
      where: { id: hearing.caseId },
      data: {
        nextHearingAt: input.nextHearingDate,
      },
    }),
  ]);

  const hearingAfter = pickAuditFields(
    adjournedHearing as Record<string, unknown>,
    ["hearingDate", "isAdjourned", "outcome", "notes", "caseUnitId"] as const
  );

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "hearing.adjourn",
    entity: "Hearing",
    entityUnitId: hearing.unitId,
    meta: {
      before: hearingBefore,
      after: hearingAfter,
      changes: diffAudit(hearingBefore, hearingAfter),
      nextHearingUnitId: nextHearing.unitId,
      nextHearing: pickAuditFields(nextHearing as Record<string, unknown>, [
        "hearingDate",
        "purpose",
        "caseUnitId",
      ] as const),
    },
  });

  const label =
    caseItem.caseNumber || caseItem.filingNumber || caseItem.unitId;
  const nextDateLabel = istDisplayDate(nextHearing.hearingDate);

  scheduleNotify(async () => {
    const recipients = await findCaseNotifyRecipients(user.officeId, [
      ...caseItem.advocateMobiles,
      caseItem.primaryAdvocateMobile,
    ]);
    await notifyUsers(
      recipients
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "hearing_adjourned",
          title: `Hearing adjourned: ${label}`,
          body: `Next date ${nextDateLabel}`,
          href: `/cases/${caseItem.unitId}`,
          meta: {
            hearingUnitId: nextHearing.unitId,
            caseUnitId: caseItem.unitId,
            previousHearingUnitId: hearing.unitId,
          },
        }))
    );

    if (isHearingWithinNextIstDays(nextHearing.hearingDate, 2)) {
      await notifyUsers(
        recipients
          .filter((u) => u.id !== user.id)
          .map((u) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: u.id,
            userUnitId: u.unitId,
            type: "hearing_tomorrow",
            title: `Hearing soon: ${label}`,
            body: nextDateLabel,
            href: `/cases/${caseItem.unitId}`,
            meta: {
              hearingUnitId: nextHearing.unitId,
              caseUnitId: caseItem.unitId,
            },
          }))
      );
    }
  });

  return jsonOk({ hearing: toHearingSummary(nextHearing) });
});
