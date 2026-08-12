import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { voidExpenseSchema } from "@/lib/validations/expenses.schema";
import { toExpenseSummary } from "@/features/expenses/server/serialize";

/** Void, never delete — expense entries stay in the audit trail forever. */
export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "expenses", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.officeExpense.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Expense not found", 404);

  if (item.voidedAt) {
    return jsonFail("CONFLICT", "This expense is already void", 409);
  }

  const raw = await request.json();
  const parsed = voidExpenseSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }

  const before = pickAuditFields(item as Record<string, unknown>, [
    "amount",
    "category",
    "voidReason",
    "voidedAt",
  ] as const);

  const updated = await prisma.officeExpense.update({
    where: { id: item.id },
    data: {
      voidedAt: new Date(),
      voidedById: user.id,
      voidReason: parsed.data.reason,
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, [
    "amount",
    "category",
    "voidReason",
    "voidedAt",
  ] as const);

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "expense.void",
    entity: "OfficeExpense",
    entityUnitId: updated.unitId,
    meta: {
      before,
      after,
      changes: diffAudit(before, after),
      reason: parsed.data.reason,
    },
  });

  return jsonOk({ expense: toExpenseSummary(updated) });
});
