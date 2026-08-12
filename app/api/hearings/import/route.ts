import { createImportHandler } from "@/lib/imports/run-import";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { importHearingsSchema } from "@/lib/validations/cases.schema";
import {
  istAddCalendarDays,
  istDateKey,
  istDayBounds,
  istDisplayDate,
  parseIstDateInput,
} from "@/lib/utils/ist";
import { findCaseByUnitId } from "@/lib/imports/lookups";
import { IMPORT_HEARING_COLUMNS } from "@/lib/imports/columns";
import { sendHearingSmsForUnitIds } from "@/lib/services/hearing-sms.job";
import {
  findCaseNotifyRecipients,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

const CLOSED = new Set([
  "disposed",
  "withdrawn",
  "transferred",
  "archived",
]);

function smsHint(input: {
  hearingKey: string;
  todayKey: string;
  tomorrowKey: string;
  smsConsent: boolean | null | undefined;
  hasMobile: boolean;
  caseStatus: string;
}): string {
  if (CLOSED.has(input.caseStatus)) {
    return "no client SMS (case closed)";
  }
  if (input.smsConsent === false) {
    return "no client SMS (opted out)";
  }
  if (!input.hasMobile) {
    return "no client SMS (missing mobile)";
  }
  if (input.hearingKey < input.todayKey) {
    return "past date — no day-before SMS";
  }
  if (input.hearingKey === input.todayKey) {
    return "today — day-before SMS window already passed";
  }
  if (input.hearingKey === input.tomorrowKey) {
    return "tomorrow — client SMS will send now (or with tonight’s cron)";
  }
  return "client SMS auto day before hearing";
}

export const POST = createImportHandler({
  perm: ["cases", "edit"],
  schema: importHearingsSchema,
  columns: IMPORT_HEARING_COLUMNS,
  audit: { action: "hearings.import", entity: "Hearing" },
  async processRows(rows, { user, dryRun }) {
    const results = [];
    const todayKey = istDateKey();
    const tomorrowKey = istAddCalendarDays(todayKey, 1);
    const { start: todayStart } = istDayBounds(todayKey);
    const touchedCaseIds = new Set<string>();
    const tomorrowSmsUnitIds: string[] = [];
    const nearNotify: Array<{
      hearingUnitId: string;
      caseUnitId: string;
      hearingDate: Date;
      advocateMobiles: string[];
      primaryAdvocateMobile: string | null;
      caseLabel: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;

      try {
        const caseItem = await findCaseByUnitId(row.caseUnitId, user.officeId);
        if (!caseItem) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "Case not found (set caseUnitId)",
          });
          continue;
        }

        const hearingDate = parseIstDateInput(row.hearingDate);
        if (!hearingDate) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "error" as const,
            message: "Invalid hearingDate (use YYYY-MM-DD)",
          });
          continue;
        }

        const hearingKey = istDateKey(hearingDate);
        const client = await prisma.client.findUnique({
          where: { id: caseItem.clientId },
          select: { mobile: true, smsConsent: true, name: true },
        });
        const hint = smsHint({
          hearingKey,
          todayKey,
          tomorrowKey,
          smsConsent: client?.smsConsent,
          hasMobile: Boolean(client?.mobile?.trim()),
          caseStatus: caseItem.status,
        });

        if (caseItem.primaryAdvocateMobile) {
          const {
            assertAdvocateCourtDayAvailable,
            clashMessage,
          } = await import("@/lib/hearings/advocate-day");
          const clash = await assertAdvocateCourtDayAvailable({
            officeId: user.officeId,
            advocateMobile: caseItem.primaryAdvocateMobile,
            hearingDate,
            court: caseItem,
          });
          if (!clash.ok) {
            results.push({
              row: rowNum,
              unitId: null,
              status: "error" as const,
              message: clashMessage(clash),
            });
            continue;
          }
        }

        if (dryRun) {
          results.push({
            row: rowNum,
            unitId: null,
            status: "ok" as const,
            message: `Will create for ${caseItem.unitId} on ${hearingKey} · ${hint}`,
          });
          continue;
        }

        const unitId = await nextUnitId("hearing", user);
        const [hearing] = await prisma.$transaction([
          prisma.hearing.create({
            data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
              unitId,
              caseId: caseItem.id,
              caseUnitId: caseItem.unitId,
              hearingDate,
              purpose: row.purpose || undefined,
              notes: row.notes || undefined,
              createdById: user.id,
            },
          }),
          prisma.case.update({
            where: { id: caseItem.id },
            data: {
              // Temporary; reconciled to earliest upcoming after the batch.
              nextHearingAt: hearingDate,
            },
          }),
        ]);

        touchedCaseIds.add(caseItem.id);

        if (hearingKey === tomorrowKey) {
          tomorrowSmsUnitIds.push(hearing.unitId);
        }

        if (hearingKey >= todayKey && hearingKey <= tomorrowKey) {
          nearNotify.push({
            hearingUnitId: hearing.unitId,
            caseUnitId: caseItem.unitId,
            hearingDate,
            advocateMobiles: caseItem.advocateMobiles ?? [],
            primaryAdvocateMobile: caseItem.primaryAdvocateMobile,
            caseLabel:
              caseItem.caseNumber ||
              caseItem.filingNumber ||
              caseItem.unitId,
          });
        }

        results.push({
          row: rowNum,
          unitId: hearing.unitId,
          status: "ok" as const,
          message: `Created ${hearingKey} · ${hint}`,
        });
      } catch (err) {
        results.push({
          row: rowNum,
          unitId: null,
          status: "error" as const,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    if (!dryRun && touchedCaseIds.size > 0) {
      // Set nextHearingAt to earliest upcoming (non-adjourned) hearing per case.
      await Promise.all(
        [...touchedCaseIds].map(async (caseId) => {
          const next = await prisma.hearing.findFirst({
            where: {
              caseId,
              isAdjourned: false,
              hearingDate: { gte: todayStart },
            },
            orderBy: { hearingDate: "asc" },
            select: { hearingDate: true },
          });
          await prisma.case.update({
            where: { id: caseId },
            data: { nextHearingAt: next?.hearingDate ?? null },
          });
        })
      );
    }

    let smsSent = 0;
    let smsFailed = 0;
    if (!dryRun && tomorrowSmsUnitIds.length > 0) {
      // Catch-up if nightly cron already ran — claim-then-send is idempotent.
      const sms = await sendHearingSmsForUnitIds(tomorrowSmsUnitIds);
      smsSent = sms.sent;
      smsFailed = sms.failed;
      if (sms.sent > 0 || sms.failed > 0) {
        for (const d of sms.details) {
          const row = results.find((r) => r.unitId === d.hearingUnitId);
          if (!row || row.status !== "ok") continue;
          row.message = d.ok
            ? `${row.message} · SMS sent`
            : `${row.message} · SMS failed: ${d.message}`;
        }
      }
    }

    if (!dryRun && nearNotify.length > 0) {
      scheduleNotify(async () => {
        for (const item of nearNotify) {
          const recipients = await findCaseNotifyRecipients(user.officeId, [
            ...item.advocateMobiles,
            item.primaryAdvocateMobile,
          ]);
          await notifyUsers(
            recipients
              .filter((u) => u.id !== user.id)
              .map((u) => ({
                officeId: user.officeId,
                officeUnitId: user.officeUnitId,
                userId: u.id,
                userUnitId: u.unitId,
                type: "hearing_tomorrow" as const,
                title: `Hearing soon: ${item.caseLabel}`,
                body: istDisplayDate(item.hearingDate),
                href: `/cases/${item.caseUnitId}`,
                meta: {
                  hearingUnitId: item.hearingUnitId,
                  caseUnitId: item.caseUnitId,
                },
              }))
          );
        }
      });
    }

    return {
      results,
      auditMeta: {
        tomorrowSmsQueued: tomorrowSmsUnitIds.length,
        smsSent,
        smsFailed,
      },
    };
  },
});
