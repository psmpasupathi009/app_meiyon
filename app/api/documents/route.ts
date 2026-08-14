import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm, requireUser } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { documentUploadMetaSchema } from "@/lib/validations/documents.schema";
import { toDocumentSummary } from "@/features/documents/server/serialize";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import {
  CLIENT_UPLOAD_DOC_TYPES,
  isClientOnlyUser,
  isClientUploadDocType,
} from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";
import { requirePlanModule } from "@/lib/auth/plan-gate";

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  let caseUnitId = searchParams.get("caseUnitId")?.trim() || undefined;
  let clientUnitId = searchParams.get("clientUnitId")?.trim() || undefined;
  const expenseUnitId = searchParams.get("expenseUnitId")?.trim() || undefined;

  const { user, response } = await requireUser(request);
  if (!user) return response;

  if (!isClientOnlyUser(user.roles)) {
    const planFail = await requirePlanModule(user, "documents");
    if (planFail) return planFail;
  }

  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    if (expenseUnitId) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }
    if (clientUnitId && clientUnitId !== cid) {
      return jsonFail("NOT_FOUND", "Documents not found", 404);
    }
    if (caseUnitId) {
      const cse = await prisma.case.findFirst({ where: { unitId: caseUnitId, officeId: user.officeId },
        select: { clientUnitId: true },
      });
      if (!cse || cse.clientUnitId !== cid) {
        return jsonFail("NOT_FOUND", "Documents not found", 404);
      }
    }

    // No parent filter → all docs for this client (direct + on own cases)
    if (!caseUnitId && !clientUnitId) {
      const ownCases = await prisma.case.findMany({
        where: { clientUnitId: cid },
        select: { unitId: true },
      });
      const caseUnitIds = ownCases.map((c) => c.unitId);
      const whereAll = {
        AND: [
          { docType: { not: "receipt" as const } },
          { OR: [{ expenseUnitId: null }, { expenseUnitId: { isSet: false } }] },
          {
            OR: [
              { clientUnitId: cid },
              ...(caseUnitIds.length
                ? [{ caseUnitId: { in: caseUnitIds } }]
                : []),
            ],
          },
        ],
      };
      const [rows, total] = await Promise.all([
        prisma.document.findMany({
          where: whereAll,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.document.count({ where: whereAll }),
      ]);
      return jsonOkList(rows.map(toDocumentSummary), { page, pageSize, total });
    }
  } else {
    if (!caseUnitId && !clientUnitId && !expenseUnitId) {
      return jsonFail(
        "VALIDATION",
        "Provide caseUnitId, clientUnitId, or expenseUnitId to list documents",
        400
      );
    }
    if (expenseUnitId) {
      const { user: u, response: r } = await requirePerm(
        request,
        "expenses",
        "view"
      );
      if (!u) return r;
    } else {
      const { user: u, response: r } = await requirePerm(
        request,
        "cases",
        "view"
      );
      if (!u) return r;
    }
  }

  if (!caseUnitId && !clientUnitId && !expenseUnitId) {
    return jsonFail(
      "VALIDATION",
      "Provide caseUnitId, clientUnitId, or expenseUnitId to list documents",
      400
    );
  }

  const where = {
    ...(caseUnitId ? { caseUnitId } : {}),
    ...(clientUnitId ? { clientUnitId } : {}),
    ...(expenseUnitId ? { expenseUnitId } : {}),
    // Client portal: never list fee receipts / expense bills (metadata leak)
    ...(isClientOnlyUser(user.roles)
      ? {
          docType: { not: "receipt" as const },
          OR: [{ expenseUnitId: null }, { expenseUnitId: { isSet: false } }],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.document.count({ where }),
  ]);

  return jsonOkList(rows.map(toDocumentSummary), { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  if (!isClientOnlyUser(user.roles)) {
    const planFail = await requirePlanModule(user, "documents");
    if (planFail) return planFail;
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonFail("VALIDATION", "A file is required", 400);
  }

  const parsed = documentUploadMetaSchema.safeParse({
    title: form.get("title")?.toString() ?? file.name,
    docType: form.get("docType")?.toString() || "other",
    notes: form.get("notes")?.toString() ?? "",
    caseUnitId: form.get("caseUnitId")?.toString() ?? "",
    clientUnitId: form.get("clientUnitId")?.toString() ?? "",
    expenseUnitId: form.get("expenseUnitId")?.toString() ?? "",
  });
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = { ...parsed.data };

  const clientActor = isClientOnlyUser(user.roles);
  if (clientActor) {
    const cid = requireClientUnitId(user);
    if (!cid) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    if (input.expenseUnitId) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }
    if (!isClientUploadDocType(input.docType)) {
      return jsonFail(
        "VALIDATION",
        `Clients may upload: ${CLIENT_UPLOAD_DOC_TYPES.join(", ")}`,
        400
      );
    }
    if (!(await hasPermission(user, "cases", "upload"))) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }
    input.clientUnitId = cid;
    if (input.caseUnitId) {
      const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
        select: { id: true, clientUnitId: true },
      });
      if (!caseItem || caseItem.clientUnitId !== cid) {
        return jsonFail("NOT_FOUND", "Case not found", 404);
      }
    }
  } else {
    const canCasesUpload =
      isModuleEnabled("cases") &&
      (await hasPermission(user, "cases", "upload"));
    const canAccountsReceipt =
      input.docType === "receipt" &&
      !input.expenseUnitId &&
      isModuleEnabled("accounts") &&
      ((await hasPermission(user, "accounts", "edit")) ||
        (await hasPermission(user, "accounts", "upload")));
    const canExpenseBill =
      Boolean(input.expenseUnitId) &&
      isModuleEnabled("expenses") &&
      ((await hasPermission(user, "expenses", "create")) ||
        (await hasPermission(user, "expenses", "edit")) ||
        (await hasPermission(user, "expenses", "upload")));
    if (!canCasesUpload && !canAccountsReceipt && !canExpenseBill) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }
  }

  let caseId: string | undefined;
  if (input.caseUnitId) {
    const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId } });
    if (!caseItem) return jsonFail("VALIDATION", "Case not found", 400);
    caseId = caseItem.id;
  }

  let clientId: string | undefined;
  if (input.clientUnitId) {
    const client = await prisma.client.findFirst({ where: { unitId: input.clientUnitId, officeId: user.officeId } });
    if (!client) return jsonFail("VALIDATION", "Client not found", 400);
    clientId = client.id;
  }

  let expenseId: string | undefined;
  if (input.expenseUnitId) {
    const expense = await prisma.officeExpense.findFirst({ where: { unitId: input.expenseUnitId, officeId: user.officeId },
    });
    if (!expense) return jsonFail("VALIDATION", "Expense not found", 400);
    expenseId = expense.id;
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await storage.put({
      buffer,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      folder:
        input.expenseUnitId ||
        input.caseUnitId ||
        input.clientUnitId ||
        "misc",
    });
  } catch (error) {
    return jsonFail("VALIDATION", error instanceof Error ? error.message : "Upload failed", 400);
  }

  const unitId = await nextUnitId("document", user);
  const created = await prisma.document.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      title: input.title,
      docType: input.docType,
      notes: input.notes || undefined,
      caseId,
      caseUnitId: input.caseUnitId || undefined,
      clientId,
      clientUnitId: input.clientUnitId || undefined,
      expenseId,
      expenseUnitId: input.expenseUnitId || undefined,
      fileKey: stored.key,
      mimeType: stored.mimeType,
      size: stored.size,
      originalName: stored.originalName,
      uploadedById: user.id,
    },
  });

  if (expenseId && input.expenseUnitId) {
    await prisma.officeExpense.update({
      where: { id: expenseId },
      data: {
        billDocumentId: created.id,
        billDocumentUnitId: created.unitId,
      },
    });
  }

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: clientActor ? "document.upload.client" : "document.upload",
    entity: "Document",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "title",
        "docType",
        "notes",
        "caseUnitId",
        "clientUnitId",
        "expenseUnitId",
        "mimeType",
        "size",
        "originalName",
      ] as const),
    },
  });

  if (input.caseUnitId) {
    const { scheduleNotify, notifyUsers, findCaseNotifyRecipients } =
      await import("@/lib/notifications/notify");
    scheduleNotify(async () => {
      const cse = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
        select: {
          unitId: true,
          caseNumber: true,
          filingNumber: true,
          advocateMobiles: true,
          primaryAdvocateMobile: true,
        },
      });
      if (!cse) return;
      const recipients = await findCaseNotifyRecipients(user.officeId, [
        ...cse.advocateMobiles,
        cse.primaryAdvocateMobile,
      ]);
      const label = cse.caseNumber || cse.filingNumber || cse.unitId;
      await notifyUsers(
        recipients
          .filter((u) => u.id !== user.id)
          .map((u) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: u.id,
            userUnitId: u.unitId,
            type: "document_uploaded",
            title: clientActor
              ? `Client uploaded: ${label}`
              : `Document uploaded: ${label}`,
            body: created.title,
            href: `/cases/${cse.unitId}`,
            meta: {
              documentUnitId: created.unitId,
              caseUnitId: cse.unitId,
            },
          }))
      );
    });
  }

  return jsonOk({ document: toDocumentSummary(created) }, 201);
});
