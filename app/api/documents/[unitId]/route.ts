import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { canMutateDocument } from "@/features/documents/server/access";

export const DELETE = apiHandler(async (request, context) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const doc = unitId
    ? await prisma.document.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!doc) return jsonFail("NOT_FOUND", "Document not found", 404);

  if (!(await canMutateDocument(user, doc))) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  await storage.delete(doc.fileKey);
  await prisma.document.delete({ where: { id: doc.id } });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "document.delete",
    entity: "Document",
    entityUnitId: doc.unitId,
    meta: {
      before: pickAuditFields(doc as Record<string, unknown>, [
        "title",
        "docType",
        "notes",
        "caseUnitId",
        "clientUnitId",
        "mimeType",
        "size",
        "originalName",
      ] as const),
    },
  });

  return jsonOk({ deleted: true, unitId: doc.unitId });
});
