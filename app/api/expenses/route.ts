import { NextResponse } from "next/server";
import { apiHandler, jsonFail, jsonOk, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { requirePlanModule } from "@/lib/auth/plan-gate";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { createExpenseFieldsSchema } from "@/lib/validations/expenses.schema";
import { toExpenseSummary } from "@/features/expenses/server/serialize";
import { resolveExpenseActorsByIds } from "@/features/expenses/server/actors";
import {
  buildExpensesSummaryWhere,
  buildExpensesWhere,
  parseExpensesFilters,
} from "@/features/expenses/server/filters";
import { storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import { compliance } from "@/config/company/compliance";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "expenses", "view");
  if (!user) return response;
  const planFail = await requirePlanModule(user, "expenses");
  if (planFail) return planFail;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const filters = parseExpensesFilters(searchParams);
  const where = buildExpensesWhere(filters);
  const summaryWhere = buildExpensesSummaryWhere(filters);

  const [rows, total, aggregate] = await Promise.all([
    prisma.officeExpense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.officeExpense.count({ where }),
    prisma.officeExpense.aggregate({
      where: summaryWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const actorMap = await resolveExpenseActorsByIds(
    rows.flatMap((r) => [r.createdById, r.voidedById])
  );

  const data = rows.map((r) =>
    toExpenseSummary(r, {
      createdBy: r.createdById ? actorMap.get(r.createdById) ?? null : null,
      voidedBy: r.voidedById ? actorMap.get(r.voidedById) ?? null : null,
    })
  );

  return NextResponse.json({
    ok: true,
    data,
    meta: { page, pageSize, total },
    summary: {
      totalAmount: aggregate._sum.amount ?? 0,
      entryCount: aggregate._count._all,
    },
  });
});

/** Multipart create: fields + required bill file. */
export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "expenses", "create");
  if (!user) return response;
  const planFailCreate = await requirePlanModule(user, "expenses");
  if (planFailCreate) return planFailCreate;

  const limited = await rateLimit(
    clientRateKey(request, "expense-create", user.unitId),
    30,
    15 * 60 * 1000
  );
  if (!limited.allowed) {
    return jsonFail(
      "RATE_LIMITED",
      "Too many submissions. Try again in a few minutes.",
      429
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonFail(
      "VALIDATION",
      "Upload the expense with a bill attachment (multipart form)",
      400
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonFail("VALIDATION", "A bill / receipt file is required", 400);
  }

  if (file.size > compliance.uploads.maxBytes) {
    return jsonFail("VALIDATION", "File too large (max 10 MB)", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const parsed = createExpenseFieldsSchema.safeParse({
    expenseDate: form.get("expenseDate")?.toString() ?? "",
    category: form.get("category")?.toString() ?? "",
    vendor: form.get("vendor")?.toString() ?? "",
    description: form.get("description")?.toString() ?? "",
    amount: form.get("amount")?.toString() ?? "",
    paymentMode: form.get("paymentMode")?.toString() || "cash",
  });
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const expenseUnitId = await nextUnitId("expense", user);
  const docUnitId = await nextUnitId("document", user);

  let stored;
  try {
    stored = await storage.put({
      buffer,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      folder: expenseUnitId,
    });
  } catch (error) {
    return jsonFail(
      "VALIDATION",
      error instanceof Error ? error.message : "Upload failed",
      400
    );
  }

  const expense = await prisma.officeExpense.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId: expenseUnitId,
      expenseDate: input.expenseDate,
      category: input.category,
      vendor: input.vendor?.trim() ? input.vendor.trim() : undefined,
      description: input.description,
      amount: input.amount,
      paymentMode: input.paymentMode,
      createdById: user.id,
    },
  });

  const document = await prisma.document.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId: docUnitId,
      title: `Bill — ${expenseUnitId}`,
      docType: "receipt",
      expenseId: expense.id,
      expenseUnitId: expense.unitId,
      fileKey: stored.key,
      mimeType: stored.mimeType,
      size: stored.size,
      originalName: stored.originalName,
      uploadedById: user.id,
    },
  });

  const created = await prisma.officeExpense.update({
    where: { id: expense.id },
    data: {
      billDocumentId: document.id,
      billDocumentUnitId: document.unitId,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "expense.create",
    entity: "OfficeExpense",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "expenseDate",
        "category",
        "vendor",
        "description",
        "amount",
        "paymentMode",
        "billDocumentUnitId",
      ] as const),
    },
  });

  return jsonOk({ expense: toExpenseSummary(created) }, 201);
});
