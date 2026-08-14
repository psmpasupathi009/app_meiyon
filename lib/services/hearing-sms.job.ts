import type { Hearing } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { writeAudit } from "@/lib/audit";
import { normalizeMobile } from "@/lib/auth/mobile";
import { sendTransactionalSms, hearingSmsConfigured } from "@/lib/services/two-factor.service";
import { smsTemplates } from "@/config/company/sms-templates";
import {
  istDateKey,
  istDayBounds,
  istDisplayDate,
  istAddCalendarDays,
} from "@/lib/utils/ist";
import { planHasModule } from "@meiyon/config";
import { requireOfficeSubscription } from "@/lib/billing/access";

async function officeSmsEntitlement(officeId: string) {
  const ctx = await requireOfficeSubscription(officeId);
  if (!ctx) return { allowed: false, smsLimit: 0 };
  return {
    allowed: planHasModule(ctx.planCode, "hearing_sms"),
    smsLimit: ctx.plan.smsLimit,
  };
}

async function incrementSmsUsage(officeId: string) {
  const month = new Date().toISOString().slice(0, 7);
  await prisma.usageCounter.upsert({
    where: { officeId_month: { officeId, month } },
    create: { officeId, month, smsSent: 1 },
    update: { smsSent: { increment: 1 } },
  });
}

async function smsQuotaRemaining(officeId: string, smsLimit: number) {
  const month = new Date().toISOString().slice(0, 7);
  const counter = await prisma.usageCounter.findUnique({
    where: { officeId_month: { officeId, month } },
  });
  return smsLimit - (counter?.smsSent ?? 0);
}

export type HearingSmsDetail = {
  hearingUnitId: string;
  caseUnitId: string;
  ok: boolean;
  message: string;
};

export type HearingSmsJobResult = {
  date: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  /** True when more due hearings remain (batch capped for serverless time). */
  hasMore: boolean;
  details: HearingSmsDetail[];
};

const CLOSED_CASE_STATUSES = new Set([
  "disposed",
  "withdrawn",
  "transferred",
  "archived",
]);
/** Cap per invocation so Vercel cron stays within maxDuration. */
const BATCH_SIZE = 80;
const SEND_CONCURRENCY = 5;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

type RowResult = {
  sent: number;
  failed: number;
  skipped: number;
  detail: HearingSmsDetail;
};

async function processHearingSmsBatch(
  dueHearings: Hearing[]
): Promise<Omit<HearingSmsJobResult, "date" | "hasMore">> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const details: HearingSmsDetail[] = [];

  if (dueHearings.length === 0) {
    return { total: 0, sent: 0, failed: 0, skipped: 0, details: [] };
  }

  if (!hearingSmsConfigured()) {
    return {
      total: dueHearings.length,
      sent: 0,
      failed: 0,
      skipped: dueHearings.length,
      details: dueHearings.map((h) => ({
        hearingUnitId: h.unitId,
        caseUnitId: h.caseUnitId,
        ok: true,
        message: "Skipped — hearing SMS DLT template not configured",
      })),
    };
  }

  const caseIds = Array.from(new Set(dueHearings.map((h) => h.caseId)));
  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds } },
    select: {
      id: true,
      unitId: true,
      clientId: true,
      status: true,
      caseNumber: true,
      courtName: true,
    },
  });
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const clientIds = Array.from(new Set(cases.map((c) => c.clientId)));
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: {
      id: true,
      name: true,
      mobile: true,
      smsConsent: true,
    },
  });
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const officeIds = Array.from(new Set(dueHearings.map((h) => h.officeId)));
  const officeRows = await prisma.office.findMany({
    where: { id: { in: officeIds } },
    select: { id: true, displayName: true, name: true },
  });
  const officeById = new Map(officeRows.map((o) => [o.id, o]));
  const officeEntitlements = new Map<
    string,
    Awaited<ReturnType<typeof officeSmsEntitlement>>
  >();
  for (const officeId of officeIds) {
    officeEntitlements.set(officeId, await officeSmsEntitlement(officeId));
  }

  const rowResults = await mapPool(
    dueHearings,
    SEND_CONCURRENCY,
    async (hearing): Promise<RowResult> => {
      try {
        const caseItem = caseById.get(hearing.caseId);
        if (!caseItem) {
          return {
            sent: 0,
            failed: 1,
            skipped: 0,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: false,
              message: "Case not found",
            },
          };
        }

        if (CLOSED_CASE_STATUSES.has(caseItem.status)) {
          await prisma.hearing.update({
            where: { id: hearing.id },
            data: { smsSentAt: new Date() },
          });
          return {
            sent: 0,
            failed: 0,
            skipped: 1,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: `Skipped — case ${caseItem.status}`,
            },
          };
        }

        const client = clientById.get(caseItem.clientId);
        if (!client) {
          return {
            sent: 0,
            failed: 1,
            skipped: 0,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: false,
              message: "Client not found",
            },
          };
        }

        const entitlement = officeEntitlements.get(hearing.officeId);
        if (!entitlement?.allowed) {
          return {
            sent: 0,
            failed: 0,
            skipped: 1,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: "Skipped — Enterprise plan required for hearing SMS",
            },
          };
        }

        const remaining = await smsQuotaRemaining(
          hearing.officeId,
          entitlement.smsLimit
        );
        if (remaining <= 0) {
          return {
            sent: 0,
            failed: 0,
            skipped: 1,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: "Skipped — monthly SMS quota exhausted",
            },
          };
        }

        if (!client.smsConsent) {
          await prisma.hearing.update({
            where: { id: hearing.id },
            data: { smsSentAt: new Date() },
          });
          return {
            sent: 0,
            failed: 0,
            skipped: 1,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: "Skipped — client opted out of SMS",
            },
          };
        }

        const officeRow = officeById.get(hearing.officeId);
        const mobile = normalizeMobile(client.mobile) ?? client.mobile;
        const message = smsTemplates.hearingReminder({
          clientName: client.name,
          caseLabel: caseItem.caseNumber ?? caseItem.unitId,
          hearingDateIst: istDisplayDate(hearing.hearingDate),
          courtName: caseItem.courtName ?? "the court",
          officeName: officeRow?.displayName ?? officeRow?.name ?? "Office",
        });

        // Claim before send so cron + manual cannot double-SMS.
        const claimAt = new Date();
        const claimed = await prisma.hearing.updateMany({
          where: { id: hearing.id, smsSentAt: null },
          data: { smsSentAt: claimAt },
        });
        if (claimed.count !== 1) {
          return {
            sent: 0,
            failed: 0,
            skipped: 1,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: "Skipped — already claimed by another worker",
            },
          };
        }

        const result = await sendTransactionalSms(mobile, message);

        if (result.ok) {
          await incrementSmsUsage(hearing.officeId);
          return {
            sent: 1,
            failed: 0,
            skipped: 0,
            detail: {
              hearingUnitId: hearing.unitId,
              caseUnitId: hearing.caseUnitId,
              ok: true,
              message: result.details,
            },
          };
        }

        // Allow retry on the next run.
        await prisma.hearing.update({
          where: { id: hearing.id },
          data: { smsSentAt: null },
        });

        return {
          sent: 0,
          failed: 1,
          skipped: 0,
          detail: {
            hearingUnitId: hearing.unitId,
            caseUnitId: hearing.caseUnitId,
            ok: false,
            message: result.details,
          },
        };
      } catch (error) {
        return {
          sent: 0,
          failed: 1,
          skipped: 0,
          detail: {
            hearingUnitId: hearing.unitId,
            caseUnitId: hearing.caseUnitId,
            ok: false,
            message: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    }
  );

  for (const r of rowResults) {
    sent += r.sent;
    failed += r.failed;
    skipped += r.skipped;
    details.push(r.detail);
  }

  return {
    total: dueHearings.length,
    sent,
    failed,
    skipped,
    details,
  };
}

/**
 * Day-before hearing SMS to clients only (2Factor transactional).
 * Skips adjourned, already-sent, opted-out, and closed cases.
 * Processes up to BATCH_SIZE hearings per run (concurrent sends).
 */
export async function runHearingSmsJob(): Promise<HearingSmsJobResult> {
  const tomorrowKey = istAddCalendarDays(istDateKey(), 1);
  const { start, end } = istDayBounds(tomorrowKey);

  const dueTotal = await prisma.hearing.count({
    where: {
      smsSentAt: null,
      isAdjourned: false,
      hearingDate: { gte: start, lte: end },
    },
  });

  const dueHearings = await prisma.hearing.findMany({
    where: {
      smsSentAt: null,
      isAdjourned: false,
      hearingDate: { gte: start, lte: end },
    },
    orderBy: { hearingDate: "asc" },
    take: BATCH_SIZE,
  });

  const hasMore = dueTotal > dueHearings.length;
  const batch = await processHearingSmsBatch(dueHearings);

  await writeAudit({
    action: "cron.hearing_sms",
    entity: "Hearing",
    meta: {
      tomorrowKey,
      total: batch.total,
      dueTotal,
      sent: batch.sent,
      failed: batch.failed,
      skipped: batch.skipped,
      hasMore,
    },
  });

  return {
    date: tomorrowKey,
    ...batch,
    hasMore,
  };
}

/**
 * Send client SMS for specific hearings (e.g. imported with tomorrow’s date
 * after the nightly cron already ran). Claim-then-send; safe to call twice.
 */
export async function sendHearingSmsForUnitIds(
  unitIds: string[]
): Promise<Omit<HearingSmsJobResult, "date" | "hasMore">> {
  const unique = [...new Set(unitIds.filter(Boolean))];
  if (unique.length === 0) {
    return { total: 0, sent: 0, failed: 0, skipped: 0, details: [] };
  }

  const dueHearings = await prisma.hearing.findMany({
    where: {
      unitId: { in: unique },
      smsSentAt: null,
      isAdjourned: false,
    },
    orderBy: { hearingDate: "asc" },
    take: BATCH_SIZE,
  });

  const batch = await processHearingSmsBatch(dueHearings);

  if (batch.total > 0) {
    await writeAudit({
      action: "hearing.sms_import_catchup",
      entity: "Hearing",
      meta: {
        requested: unique.length,
        total: batch.total,
        sent: batch.sent,
        failed: batch.failed,
        skipped: batch.skipped,
      },
    });
  }

  return batch;
}
