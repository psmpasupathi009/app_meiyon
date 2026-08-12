import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { updateCaseSchema } from "@/lib/validations/cases.schema";
import { toCaseSummary, toHearingSummary } from "@/features/cases/server/serialize";
import { toClientSummary } from "@/features/clients/server/serialize";
import { toDocumentSummary } from "@/features/documents/server/serialize";
import {
  canTransitionStatus,
  normalizeCaseStatus,
  PRE_NUMBER_STATUSES,
  type FilingChecklistState,
} from "@meiyon/config";
import { resolveStageForSave } from "@meiyon/config";
import {
  findCaseNotifyRecipients,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";
import { normalizeMobile } from "@/lib/auth/mobile";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import {
  requireClientUnitId,
  toClientCaseSummary,
} from "@/lib/auth/client-scope";

const CASE_AUDIT_KEYS = [
  "caseNumber",
  "filingNumber",
  "caseYear",
  "cnr",
  "state",
  "district",
  "city",
  "courtName",
  "advocateMobiles",
  "primaryAdvocateMobile",
  "opposingParty",
  "ourSide",
  "underActs",
  "policeStation",
  "firNumber",
  "stage",
  "caseType",
  "status",
  "filingDate",
  "nextHearingAt",
  "agreedFee",
  "notes",
  "battaDue",
  "awaitingService",
  "filingChecklist",
] as const;

function parseChecklist(raw: Prisma.JsonValue | null | undefined): FilingChecklistState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as FilingChecklistState;
}

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "cases", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId ? await prisma.case.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!item) return jsonFail("NOT_FOUND", "Case not found", 404);

  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid || item.clientUnitId !== cid) {
      return jsonFail("NOT_FOUND", "Case not found", 404);
    }
  }

  const [client, hearings, documents] = await Promise.all([
    prisma.client.findUnique({ where: { id: item.clientId } }),
    prisma.hearing.findMany({
      where: { caseId: item.id },
      orderBy: { hearingDate: "desc" },
      take: 100,
    }),
    prisma.document.findMany({
      where: { caseId: item.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

    const clientActor = isClientOnlyUser(user.roles);
  return jsonOk({
    case: clientActor ? toClientCaseSummary(item) : toCaseSummary(item),
    client: client
      ? clientActor
        ? {
            unitId: client.unitId,
            name: client.name,
            mobile: client.mobile,
          }
        : toClientSummary(client)
      : null,
    hearings: hearings.map((h) => {
      const summary = toHearingSummary(h);
      if (!clientActor) return summary;
      return { ...summary, notes: null, outcome: summary.outcome };
    }),
    documents: documents
      .filter((d) => {
        if (!clientActor) return true;
        // Hide fee receipts / expense bills from client portal
        if (d.docType === "receipt" || d.expenseUnitId) return false;
        return true;
      })
      .map(toDocumentSummary),
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  if (isClientOnlyUser(user.roles)) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const { unitId } = (await context.params) ?? {};
  const item = unitId ? await prisma.case.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!item) return jsonFail("NOT_FOUND", "Case not found", 404);

  const raw = await request.json();
  const parsed = updateCaseSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  if (input.caseNumber) {
    const dupe = await prisma.case.findFirst({
      where: { caseNumber: input.caseNumber, id: { not: item.id } },
    });
    if (dupe) return jsonFail("CONFLICT", "A case with this case number already exists", 409);
  }

  const caseNumberNewlySet = Boolean(input.caseNumber) && !item.caseNumber;
  const cnrNewlySet = Boolean(input.cnr) && !item.cnr;
  const isPreNumber = PRE_NUMBER_STATUSES.includes(normalizeCaseStatus(item.status));

  let nextStatus = input.status;
  let nextChecklist: FilingChecklistState | undefined = input.filingChecklist
    ? {
        ...parseChecklist(item.filingChecklist),
        ...(input.filingChecklist as FilingChecklistState),
      }
    : undefined;

  if (nextStatus && nextStatus !== item.status) {
    if (!canTransitionStatus(item.status, nextStatus)) {
      return jsonFail(
        "VALIDATION",
        `Cannot move case from “${normalizeCaseStatus(item.status)}” to “${normalizeCaseStatus(nextStatus)}”. Use the pipeline steps on the case page.`,
        400
      );
    }
  }

  if (
    !nextStatus &&
    (caseNumberNewlySet || cnrNewlySet) &&
    isPreNumber
  ) {
    nextStatus = "active";
    nextChecklist = {
      ...(nextChecklist ?? parseChecklist(item.filingChecklist)),
      numbered: true,
    };
  }

  const stageProvided = Object.prototype.hasOwnProperty.call(input, "stage");
  const caseTypeProvided = Object.prototype.hasOwnProperty.call(
    input,
    "caseType"
  );
  const stageResolved = resolveStageForSave({
    nextStage: input.stage,
    nextCaseType:
      input.caseType === "" ? null : (input.caseType ?? null),
    prevStage: item.stage,
    prevCaseType: item.caseType,
    stageProvided,
    caseTypeProvided,
  });
  if (!stageResolved.ok) {
    return jsonFail("VALIDATION", stageResolved.message, 400);
  }

  const before = pickAuditFields(item as Record<string, unknown>, CASE_AUDIT_KEYS);

  const primaryAdvocateMobile =
    input.primaryAdvocateMobile === undefined
      ? undefined
      : input.primaryAdvocateMobile === ""
        ? null
        : normalizeMobile(input.primaryAdvocateMobile) ??
          input.primaryAdvocateMobile;
  const advocateMobiles =
    input.advocateMobiles === undefined
      ? undefined
      : input.advocateMobiles.map((m) => normalizeMobile(m) ?? m);

  const updated = await prisma.case.update({
    where: { id: item.id },
    data: {
      caseNumber: input.caseNumber === "" ? null : input.caseNumber,
      filingNumber: input.filingNumber === "" ? null : input.filingNumber,
      caseYear: input.caseYear === undefined ? undefined : input.caseYear,
      cnr: input.cnr === "" ? null : input.cnr,
      state: input.state === "" ? null : input.state,
      district: input.district === "" ? null : input.district,
      city: input.city === "" ? null : input.city,
      courtName: input.courtName === "" ? null : input.courtName,
      advocateMobiles,
      primaryAdvocateMobile,
      opposingParty: input.opposingParty === "" ? null : input.opposingParty,
      ourSide: input.ourSide === "" ? null : input.ourSide,
      underActs: input.underActs === "" ? null : input.underActs,
      policeStation: input.policeStation === "" ? null : input.policeStation,
      firNumber: input.firNumber === "" ? null : input.firNumber,
      stage: stageProvided || caseTypeProvided ? stageResolved.stage : undefined,
      caseType: input.caseType === "" ? null : input.caseType,
      status: nextStatus,
      filingDate: input.filingDate,
      nextHearingAt: input.nextHearingAt,
      agreedFee: input.agreedFee,
      notes: input.notes === "" ? null : input.notes,
      ...(input.battaDue !== undefined ? { battaDue: input.battaDue } : {}),
      ...(input.awaitingService !== undefined
        ? { awaitingService: input.awaitingService }
        : {}),
      ...(nextChecklist
        ? { filingChecklist: nextChecklist as Prisma.InputJsonValue }
        : {}),
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, CASE_AUDIT_KEYS);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "case.update",
    entity: "Case",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  if (input.battaDue === true && !item.battaDue) {
    scheduleNotify(async () => {
      const recipients = await findCaseNotifyRecipients(user.officeId, [
        ...updated.advocateMobiles,
        updated.primaryAdvocateMobile,
      ]);
      const label =
        updated.caseNumber || updated.filingNumber || updated.unitId;
      await notifyUsers(
        recipients
          .filter((u) => u.id !== user.id)
          .map((u) => ({
            officeId: user.officeId,
            officeUnitId: user.officeUnitId,
            userId: u.id,
            userUnitId: u.unitId,
            type: "batta_due",
            title: `Batta due: ${label}`,
            href: `/cases/${updated.unitId}`,
            meta: { caseUnitId: updated.unitId },
          }))
      );
    });
  }

  return jsonOk({ case: toCaseSummary(updated) });
});
