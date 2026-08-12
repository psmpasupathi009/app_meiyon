import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, diffAudit } from "@/lib/audit";
import { updateExpenseSchema } from "@/lib/validations/expenses.schema";
import { toExpenseSummary } from "@/features/expenses/server/serialize";
import { resolveExpenseActorsByIds } from "@/features/expenses/server/actors";
import { toDocumentSummary } from "@/features/documents/server/serialize";
import { storage } from "@/lib/storage";
import { nextUnitId } from "@/lib/ids";
import { compliance } from "@/config/company/compliance";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "expenses", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.officeExpense.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Expense not found", 404);

  const [actorMap, activity, bill] = await Promise.all([
    resolveExpenseActorsByIds([item.createdById, item.voidedById]),
    prisma.auditLog.findMany({
      where: { entity: "OfficeExpense", entityUnitId: item.unitId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    item.billDocumentUnitId
      ? prisma.document.findFirst({ where: { unitId: item.billDocumentUnitId, officeId: user.officeId },
        })
      : Promise.resolve(null),
  ]);

  const expense = toExpenseSummary(item, {
    createdBy: item.createdById
      ? actorMap.get(item.createdById) ?? null
      : null,
    voidedBy: item.voidedById ? actorMap.get(item.voidedById) ?? null : null,
  });

  return jsonOk({
    expense,
    activity: activity.map((a) => ({
      action: a.action,
      actorUnitId: a.actorUnitId,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
    })),
    bill: bill ? toDocumentSummary(bill) : null,
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "expenses", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.officeExpense.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Expense not found", 404);

  if (item.voidedAt) {
    return jsonFail(
      "CONFLICT",
      "This expense has been voided and can’t be edited",
      409
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let fields: Record<string, unknown>;
  let file: File | null = null;

  if (isMultipart) {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File && f.size > 0) file = f;
    fields = {
      expenseDate: form.get("expenseDate")?.toString() || undefined,
      category: form.get("category")?.toString() || undefined,
      vendor: form.get("vendor")?.toString(),
      description: form.get("description")?.toString() || undefined,
      amount: form.get("amount")?.toString() || undefined,
      paymentMode: form.get("paymentMode")?.toString() || undefined,
    };
    // Drop undefined keys so zod optional works
    for (const key of Object.keys(fields)) {
      if (fields[key] === undefined) delete fields[key];
    }
  } else {
    fields = await request.json();
  }

  const parsed = updateExpenseSchema.safeParse(fields);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  if (file) {
    const canUpload =
      isModuleEnabled("expenses") &&
      ((await hasPermission(user, "expenses", "edit")) ||
        (await hasPermission(user, "expenses", "upload")));
    if (!canUpload) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }

    const limited = await rateLimit(
      clientRateKey(request, "upload", user.unitId),
      30,
      15 * 60 * 1000
    );
    if (!limited.allowed) {
      return jsonFail(
        "RATE_LIMITED",
        "Too many uploads. Try again in a few minutes.",
        429
      );
    }

    if (file.size > compliance.uploads.maxBytes) {
      return jsonFail("VALIDATION", "File too large (max 10 MB)", 400);
    }
  }

  const before = {
    expenseDate: item.expenseDate.toISOString(),
    category: item.category,
    vendor: item.vendor,
    description: item.description,
    amount: item.amount,
    paymentMode: item.paymentMode,
    billDocumentUnitId: item.billDocumentUnitId,
  };

  let billDocumentId = item.billDocumentId;
  let billDocumentUnitId = item.billDocumentUnitId;

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let stored;
    try {
      stored = await storage.put({
        buffer,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
        folder: item.unitId,
      });
    } catch (error) {
      return jsonFail(
        "VALIDATION",
        error instanceof Error ? error.message : "Upload failed",
        400
      );
    }

    const docUnitId = await nextUnitId("document", user);
    const document = await prisma.document.create({
      data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
        unitId: docUnitId,
        title: `Bill — ${item.unitId}`,
        docType: "receipt",
        expenseId: item.id,
        expenseUnitId: item.unitId,
        fileKey: stored.key,
        mimeType: stored.mimeType,
        size: stored.size,
        originalName: stored.originalName,
        uploadedById: user.id,
      },
    });
    billDocumentId = document.id;
    billDocumentUnitId = document.unitId;
  }

  const updated = await prisma.officeExpense.update({
    where: { id: item.id },
    data: {
      ...(input.expenseDate !== undefined
        ? { expenseDate: input.expenseDate }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.vendor !== undefined
        ? { vendor: input.vendor.trim() ? input.vendor.trim() : null }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.paymentMode !== undefined
        ? { paymentMode: input.paymentMode }
        : {}),
      ...(file
        ? { billDocumentId, billDocumentUnitId }
        : {}),
    },
  });

  const after = {
    expenseDate: updated.expenseDate.toISOString(),
    category: updated.category,
    vendor: updated.vendor,
    description: updated.description,
    amount: updated.amount,
    paymentMode: updated.paymentMode,
    billDocumentUnitId: updated.billDocumentUnitId,
  };

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "expense.update",
    entity: "OfficeExpense",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  return jsonOk({ expense: toExpenseSummary(updated) });
});
