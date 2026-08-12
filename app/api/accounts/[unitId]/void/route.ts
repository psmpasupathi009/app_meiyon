import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { voidPaymentSchema } from "@/lib/validations/accounts.schema";
import { toPaymentSummary } from "@/features/accounts/server/serialize";

/** Void, never delete — cash entries stay in the audit trail forever. */
export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "accounts", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId ? await prisma.cashPayment.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!item) return jsonFail("NOT_FOUND", "Payment not found", 404);

  if (item.status === "void") {
    return jsonFail("CONFLICT", "This payment is already void", 409);
  }

  const raw = await request.json();
  const parsed = voidPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }

  const before = pickAuditFields(item as Record<string, unknown>, [
    "status",
    "amount",
    "type",
    "voidReason",
  ] as const);

  const updated = await prisma.cashPayment.update({
    where: { id: item.id },
    data: {
      status: "void",
      voidedAt: new Date(),
      voidedById: user.id,
      voidReason: parsed.data.reason,
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, [
    "status",
    "amount",
    "type",
    "voidReason",
  ] as const);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "payment.void",
    entity: "CashPayment",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after), reason: parsed.data.reason },
  });

  const { scheduleNotify, notifyUsers, findUsersWithPermission, findCaseNotifyRecipients } =
    await import("@/lib/notifications/notify");
  scheduleNotify(async () => {
    const accountsUsers = await findUsersWithPermission(user.officeId, "accounts", "view");
    let caseRecipients: { id: string; unitId: string }[] = [];
    if (updated.caseUnitId) {
      const cse = await prisma.case.findFirst({ where: { unitId: updated.caseUnitId, officeId: user.officeId },
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
        type: "payment_voided",
        title: "Payment voided",
        body: `₹${updated.amount.toLocaleString("en-IN")} · ${parsed.data.reason}`,
        href: updated.caseUnitId
          ? `/cases/${updated.caseUnitId}`
          : "/accounts",
        meta: { paymentUnitId: updated.unitId },
      }))
    );
  });

  return jsonOk({ payment: toPaymentSummary(updated) });
});
