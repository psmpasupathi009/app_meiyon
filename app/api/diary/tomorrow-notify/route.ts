import { apiHandler, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { displayMobile } from "@/lib/auth/mobile";
import { istAddCalendarDays, istDateKey, istDayBounds } from "@/lib/utils/ist";

/**
 * Tomorrow’s hearings for clerks to call / WhatsApp clients
 * (pairs with the overnight hearing-SMS cron).
 */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  const tomorrowKey = istAddCalendarDays(istDateKey(), 1);
  const { start, end } = istDayBounds(tomorrowKey);

  const hearings = await prisma.hearing.findMany({
    where: {
      hearingDate: { gte: start, lte: end },
      isAdjourned: false,
    },
    orderBy: { hearingDate: "asc" },
    take: 200,
  });

  const caseUnitIds = [...new Set(hearings.map((h) => h.caseUnitId))];
  const cases = caseUnitIds.length
    ? await prisma.case.findMany({ where: { unitId: { in: caseUnitIds } } })
    : [];
  const caseMap = new Map(cases.map((c) => [c.unitId, c]));

  const clientUnitIds = [...new Set(cases.map((c) => c.clientUnitId))];
  const clients = clientUnitIds.length
    ? await prisma.client.findMany({
        where: { unitId: { in: clientUnitIds } },
      })
    : [];
  const clientMap = new Map(clients.map((c) => [c.unitId, c]));

  const items = hearings.map((h) => {
    const cse = caseMap.get(h.caseUnitId);
    const client = cse ? clientMap.get(cse.clientUnitId) : null;
    return {
      hearingUnitId: h.unitId,
      hearingDate: h.hearingDate.toISOString(),
      purpose: h.purpose,
      smsSentAt: h.smsSentAt?.toISOString() ?? null,
      caseUnitId: h.caseUnitId,
      caseNumber: cse?.caseNumber ?? null,
      courtName: cse?.courtName ?? null,
      clientUnitId: client?.unitId ?? null,
      clientName: client?.name ?? null,
      clientMobile: client?.mobile ? displayMobile(client.mobile) : null,
      smsConsent: client?.smsConsent ?? null,
    };
  });

  const pendingSms = items.filter((i) => !i.smsSentAt);
  const withMobile = pendingSms.filter((i) => i.clientMobile);

  return jsonOk({
    date: tomorrowKey,
    items,
    summary: {
      total: items.length,
      smsPending: pendingSms.length,
      smsSent: items.length - pendingSms.length,
      withMobile: withMobile.length,
    },
  });
});
