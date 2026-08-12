import { NextResponse } from "next/server";
import { apiHandler, jsonFail, jsonOk, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { requirePlanModule } from "@/lib/auth/plan-gate";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { createPaymentSchema } from "@/lib/validations/accounts.schema";
import { toPaymentSummary } from "@/features/accounts/server/serialize";
import { resolveActorsByIds } from "@/features/accounts/server/actors";
import {
  buildAccountsWhere,
  parseAccountsFilters,
} from "@/features/accounts/server/filters";
import { feeRollupForCase } from "@/features/accounts/server/fee-rollup";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "accounts", "view");
  if (!user) return response;
  const planFail = await requirePlanModule(user, "accounts");
  if (planFail) return planFail;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const filters = parseAccountsFilters(searchParams);

  let matchingClientUnitIds: string[] | undefined;
  if (filters.q) {
    const clients = await prisma.client.findMany({
      where: { name: { contains: filters.q } },
      select: { unitId: true },
      take: 100,
    });
    matchingClientUnitIds = clients.map((c) => c.unitId);
  }

  const where = buildAccountsWhere({ ...filters, matchingClientUnitIds });

  const [rows, total, totals] = await Promise.all([
    prisma.cashPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.cashPayment.count({ where }),
    prisma.cashPayment.groupBy({ by: ["status"], where, _sum: { amount: true } }),
  ]);

  const clientIds = Array.from(new Set(rows.map((r) => r.clientUnitId)));
  const [clients, actorMap] = await Promise.all([
    prisma.client.findMany({
      where: { unitId: { in: clientIds } },
      select: { unitId: true, name: true },
    }),
    resolveActorsByIds(rows.flatMap((r) => [r.createdById, r.voidedById])),
  ]);
  const clientMap = new Map(clients.map((c) => [c.unitId, c.name]));

  const data = rows.map((r) => ({
    ...toPaymentSummary(r, {
      createdBy: r.createdById ? actorMap.get(r.createdById) ?? null : null,
      voidedBy: r.voidedById ? actorMap.get(r.voidedById) ?? null : null,
    }),
    clientName: clientMap.get(r.clientUnitId) ?? null,
  }));

  const paid = totals.find((t) => t.status === "paid")?._sum.amount ?? 0;
  const pending = totals.find((t) => t.status === "pending")?._sum.amount ?? 0;
  const voidAmt = totals.find((t) => t.status === "void")?._sum.amount ?? 0;

  const summary = {
    paid,
    pending,
    void: voidAmt,
    netCollected: paid,
    entryCount: total,
  };

  const fee =
    filters.caseUnitId != null
      ? await feeRollupForCase(filters.caseUnitId)
      : null;

  return NextResponse.json({
    ok: true,
    data,
    meta: { page, pageSize, total },
    summary,
    fee,
  });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "accounts", "create");
  if (!user) return response;
  const planFail = await requirePlanModule(user, "accounts");
  if (planFail) return planFail;

  const raw = await request.json();
  const parsed = createPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const client = await prisma.client.findFirst({ where: { unitId: input.clientUnitId, officeId: user.officeId },
  });
  if (!client) return jsonFail("VALIDATION", "Client not found", 400);

  let caseId: string | undefined;
  let caseUnitId: string | undefined;
  if (input.caseUnitId) {
    const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
    });
    if (!caseItem) return jsonFail("VALIDATION", "Case not found", 400);
    if (caseItem.clientUnitId !== client.unitId) {
      return jsonFail("VALIDATION", "Case does not belong to the selected client", 400);
    }
    caseId = caseItem.id;
    caseUnitId = caseItem.unitId;
  }

  const status = input.status ?? "pending";
  const paidOn = status === "paid" ? input.paidOn ?? undefined : null;

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
      type: input.type,
      amount: input.amount,
      status,
      paidOn,
      notes: input.notes || undefined,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "payment.create",
    entity: "CashPayment",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "clientUnitId",
        "caseUnitId",
        "type",
        "amount",
        "status",
        "paidOn",
        "notes",
      ] as const),
    },
  });

  const { scheduleNotify, notifyUsers, findUsersWithPermission, findCaseNotifyRecipients } =
    await import("@/lib/notifications/notify");
  scheduleNotify(async () => {
    const accountsUsers = await findUsersWithPermission(user.officeId, "accounts", "view");
    let caseRecipients: { id: string; unitId: string }[] = [];
    if (created.caseUnitId) {
      const cse = await prisma.case.findFirst({ where: { unitId: created.caseUnitId, officeId: user.officeId },
        select: { advocateMobiles: true, primaryAdvocateMobile: true },
      });
      if (cse) {
        caseRecipients = await findCaseNotifyRecipients(user.officeId, [
          ...cse.advocateMobiles,
          cse.primaryAdvocateMobile,
        ]);
      }
    }
    const byId = new Map<string, { id: string; unitId: string }>();
    for (const u of [...accountsUsers, ...caseRecipients]) {
      if (u.id === user.id) continue;
      byId.set(u.id, u);
    }
    await notifyUsers(
      [...byId.values()].map((u) => ({
        officeId: user.officeId,
        officeUnitId: user.officeUnitId,
        userId: u.id,
        userUnitId: u.unitId,
        type: "payment_recorded",
        title: "Payment recorded",
        body: `₹${created.amount.toLocaleString("en-IN")} · ${created.type}`,
        href: created.caseUnitId
          ? `/cases/${created.caseUnitId}`
          : "/accounts",
        meta: { paymentUnitId: created.unitId },
      }))
    );
  });

  return jsonOk({ payment: toPaymentSummary(created) }, 201);
});
