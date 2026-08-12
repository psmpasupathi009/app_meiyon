import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, diffAudit } from "@/lib/audit";
import { updatePaymentSchema } from "@/lib/validations/accounts.schema";
import { toPaymentSummary } from "@/features/accounts/server/serialize";
import { resolveActorsByIds } from "@/features/accounts/server/actors";
import { toDocumentSummary } from "@/features/documents/server/serialize";

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "accounts", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.cashPayment.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Payment not found", 404);

  const [client, actorMap, activity, receipts] = await Promise.all([
    prisma.client.findFirst({ where: { unitId: item.clientUnitId, officeId: user.officeId },
      select: { unitId: true, name: true },
    }),
    resolveActorsByIds([item.createdById, item.voidedById]),
    prisma.auditLog.findMany({
      where: { entity: "CashPayment", entityUnitId: item.unitId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.document.findMany({
      where: {
        docType: "receipt",
        OR: [
          ...(item.caseUnitId ? [{ caseUnitId: item.caseUnitId }] : []),
          { clientUnitId: item.clientUnitId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const payment = {
    ...toPaymentSummary(item, {
      createdBy: item.createdById
        ? actorMap.get(item.createdById) ?? null
        : null,
      voidedBy: item.voidedById ? actorMap.get(item.voidedById) ?? null : null,
    }),
    clientName: client?.name ?? null,
  };

  return jsonOk({
    payment,
    activity: activity.map((a) => ({
      action: a.action,
      actorUnitId: a.actorUnitId,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
    })),
    receipts: receipts.map(toDocumentSummary),
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "accounts", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.cashPayment.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Payment not found", 404);

  if (item.status === "void") {
    return jsonFail(
      "CONFLICT",
      "This payment has been voided and can’t be edited",
      409
    );
  }

  const raw = await request.json();
  const parsed = updatePaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const nextType = input.type ?? item.type;
  const nextNotes =
    input.notes === undefined
      ? item.notes
      : input.notes === ""
        ? null
        : input.notes;
  const nextStatus = input.status ?? item.status;

  // Pending/void never keep a paid date; paid requires one.
  let nextPaidOn =
    input.paidOn !== undefined ? input.paidOn : item.paidOn;
  if (nextStatus !== "paid") {
    nextPaidOn = null;
  }

  if (nextType === "other" && !nextNotes?.trim()) {
    return jsonFail("VALIDATION", "Notes are required for Other purpose", 400);
  }
  if (nextStatus === "paid" && !nextPaidOn) {
    return jsonFail(
      "VALIDATION",
      "Paid on date is required when status is paid",
      400
    );
  }

  const before = {
    type: item.type,
    amount: item.amount,
    status: item.status,
    paidOn: item.paidOn?.toISOString() ?? null,
    notes: item.notes,
  };

  const updated = await prisma.cashPayment.update({
    where: { id: item.id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      paidOn: nextPaidOn,
      ...(input.notes !== undefined
        ? { notes: input.notes === "" ? null : input.notes }
        : {}),
    },
  });

  const after = {
    type: updated.type,
    amount: updated.amount,
    status: updated.status,
    paidOn: updated.paidOn?.toISOString() ?? null,
    notes: updated.notes,
  };

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "payment.update",
    entity: "CashPayment",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  return jsonOk({ payment: toPaymentSummary(updated) });
});
