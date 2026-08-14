import { NextResponse } from "next/server";
import { apiHandler, jsonFail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { storage } from "@/lib/storage";
import {
  canViewDocument,
  contentDispositionAttachment,
} from "@/features/documents/server/access";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requirePlanModule } from "@/lib/auth/plan-gate";

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  if (!isClientOnlyUser(user.roles)) {
    const planFail = await requirePlanModule(user, "documents");
    if (planFail) return planFail;
  }

  const { unitId } = (await context.params) ?? {};
  const doc = unitId ? await prisma.document.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!doc) return jsonFail("NOT_FOUND", "Document not found", 404);

  if (!(await canViewDocument(user, doc))) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const file = await storage.get(doc.fileKey);
  if (!file) return jsonFail("NOT_FOUND", "File not found in storage", 404);

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || doc.mimeType,
      "Content-Disposition": contentDispositionAttachment(doc.originalName),
      "Content-Length": String(doc.size),
    },
  });
});
