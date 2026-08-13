import type { Prisma } from "@prisma/client";
import {
  apiHandler,
  jsonFail,
  jsonOk,
  jsonOkList,
  parsePagination,
} from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { createCaseSchema } from "@/lib/validations/cases.schema";
import { toCaseSummary } from "@/features/cases/server/serialize";
import type { Case } from "@prisma/client";
import {
  buildCaseListWhere,
  parseCaseListFilters,
} from "@/features/cases/server/filters";
import { normalizeMobile } from "@/lib/auth/mobile";
import { resolveStageForSave } from "@meiyon/config";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import {
  requireClientUnitId,
  toClientCaseSummary,
} from "@/lib/auth/client-scope";

/** Board view may load more cards than the list page size cap. */
const BOARD_MAX_PAGE_SIZE = 200;

const CASE_AUDIT_KEYS = [
  "clientUnitId",
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

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "cases", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const filters = parseCaseListFilters(searchParams);
  filters.officeId = user.officeId;

  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    filters.clientUnitId = cid;
  }

  const isBoard = filters.view === "board";
  const { page, pageSize, skip } = isBoard
    ? (() => {
        const p = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
        const raw =
          Number(searchParams.get("pageSize") ?? BOARD_MAX_PAGE_SIZE) ||
          BOARD_MAX_PAGE_SIZE;
        const size = Math.min(BOARD_MAX_PAGE_SIZE, Math.max(1, raw));
        return { page: p, pageSize: size, skip: (p - 1) * size };
      })()
    : parsePagination(searchParams);
  const where = buildCaseListWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        unitId: true,
        clientId: true,
        clientUnitId: true,
        caseNumber: true,
        filingNumber: true,
        caseYear: true,
        cnr: true,
        state: true,
        district: true,
        city: true,
        courtName: true,
        advocateMobiles: true,
        primaryAdvocateMobile: true,
        opposingParty: true,
        ourSide: true,
        underActs: true,
        policeStation: true,
        firNumber: true,
        stage: true,
        caseType: true,
        status: true,
        filingDate: true,
        nextHearingAt: true,
        agreedFee: true,
        notes: true,
        filingChecklist: true,
        battaDue: true,
        awaitingService: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
      },
    }),
    prisma.case.count({ where }),
  ]);

  const clientIds = Array.from(new Set(rows.map((r) => r.clientId)));
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, unitId: true },
      })
    : [];
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const clientActor = isClientOnlyUser(user.roles);
  const data = rows.map((r) => ({
    ...(clientActor
      ? toClientCaseSummary(r as Case)
      : toCaseSummary(r as Case)),
    clientName: clientMap.get(r.clientId)?.name ?? null,
  }));

  return jsonOkList(data, { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "cases", "create");
  if (!user) return response;

  if (isClientOnlyUser(user.roles)) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const raw = await request.json();
  const parsed = createCaseSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  const client = await prisma.client.findFirst({ where: { unitId: input.clientUnitId, officeId: user.officeId } });
  if (!client) return jsonFail("VALIDATION", "Client not found", 400);

  if (input.caseNumber) {
    const dupe = await prisma.case.findFirst({ where: { caseNumber: input.caseNumber } });
    if (dupe) return jsonFail("CONFLICT", "A case with this case number already exists", 409);
  }

  const stageResolved = resolveStageForSave({
    nextStage: input.stage,
    nextCaseType: input.caseType || null,
    prevStage: null,
    prevCaseType: null,
    stageProvided: true,
    caseTypeProvided: true,
  });
  if (!stageResolved.ok) {
    return jsonFail("VALIDATION", stageResolved.message, 400);
  }

  const primaryAdvocateMobile = input.primaryAdvocateMobile
    ? normalizeMobile(input.primaryAdvocateMobile) ?? input.primaryAdvocateMobile
    : undefined;
  const advocateMobiles = (input.advocateMobiles ?? [])
    .map((m) => normalizeMobile(m) ?? m)
    .filter(Boolean);

  const unitId = await nextUnitId("case", user);
  const created = await prisma.case.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      clientId: client.id,
      clientUnitId: client.unitId,
      caseNumber: input.caseNumber || undefined,
      filingNumber: input.filingNumber || undefined,
      caseYear: input.caseYear,
      cnr: input.cnr || undefined,
      state: input.state || undefined,
      district: input.district || undefined,
      city: input.city || undefined,
      courtName: input.courtName || undefined,
      advocateMobiles,
      primaryAdvocateMobile,
      opposingParty: input.opposingParty || undefined,
      ourSide: input.ourSide || undefined,
      underActs: input.underActs || undefined,
      policeStation: input.policeStation || undefined,
      firNumber: input.firNumber || undefined,
      stage: stageResolved.stage || undefined,
      caseType: input.caseType || undefined,
      status: input.status ?? "enquiry",
      filingDate: input.filingDate,
      nextHearingAt: input.nextHearingAt,
      agreedFee: input.agreedFee,
      notes: input.notes || undefined,
      battaDue: input.battaDue,
      awaitingService: input.awaitingService,
      filingChecklist: input.filingChecklist as Prisma.InputJsonValue | undefined,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "case.create",
    entity: "Case",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, CASE_AUDIT_KEYS),
    },
  });

  const { scheduleNotify, notifyUsers, findCaseNotifyRecipients } = await import(
    "@/lib/notifications/notify"
  );
  scheduleNotify(async () => {
    const recipients = await findCaseNotifyRecipients(user.officeId, [
      ...created.advocateMobiles,
      created.primaryAdvocateMobile,
    ]);
    const label =
      created.caseNumber || created.filingNumber || created.unitId;
    await notifyUsers(
      recipients
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "case_created",
          title: `New case: ${label}`,
          href: `/cases/${created.unitId}`,
          meta: { caseUnitId: created.unitId },
        }))
    );
  });

  return jsonOk({ case: toCaseSummary(created) }, 201);
});
