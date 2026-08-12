import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import { normalizeMobile } from "@/lib/auth/mobile";
import { updateClientSchema } from "@/lib/validations/clients.schema";
import { toClientSummary } from "@/features/clients/server/serialize";
import { toPaymentSummary } from "@/features/accounts/server/serialize";
import { feeRollupForClient } from "@/features/accounts/server/fee-rollup";
import { toDocumentSummary } from "@/features/documents/server/serialize";

const CLIENT_AUDIT_KEYS = [
  "name",
  "fatherOrSpouse",
  "occupation",
  "gender",
  "mobile",
  "altMobile",
  "email",
  "address",
  "city",
  "district",
  "state",
  "aadhaarLast4",
  "referredBy",
  "matterBrief",
  "notes",
  "smsConsent",
] as const;

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "clients", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const client = unitId ? await prisma.client.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!client) return jsonFail("NOT_FOUND", "Client not found", 404);

  const cases = await prisma.case.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    select: {
      unitId: true,
      caseNumber: true,
      courtName: true,
      status: true,
      nextHearingAt: true,
      agreedFee: true,
    },
  });

  const canAccounts = await hasPermission(user, "accounts", "view");
  const canDocs = await hasPermission(user, "cases", "view");
  const caseUnitIds = cases.map((c) => c.unitId);

  const [payments, documents, fee] = await Promise.all([
    canAccounts
      ? prisma.cashPayment.findMany({
          where: { clientUnitId: client.unitId },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    canDocs
      ? prisma.document.findMany({
          where: {
            OR: [
              { clientUnitId: client.unitId },
              ...(caseUnitIds.length
                ? [{ caseUnitId: { in: caseUnitIds } }]
                : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    canAccounts ? feeRollupForClient(client.unitId) : Promise.resolve(null),
  ]);

  // Dedupe if a doc matches both client and case filters
  const seenDocs = new Set<string>();
  const uniqueDocuments = documents.filter((d) => {
    if (seenDocs.has(d.unitId)) return false;
    seenDocs.add(d.unitId);
    return true;
  });

  return jsonOk({
    client: toClientSummary(client),
    cases: cases.map((c) => ({
      unitId: c.unitId,
      caseNumber: c.caseNumber,
      courtName: c.courtName,
      status: c.status,
      nextHearingAt: c.nextHearingAt ? c.nextHearingAt.toISOString() : null,
      agreedFee: c.agreedFee,
    })),
    payments: payments.map((p) => toPaymentSummary(p)),
    documents: uniqueDocuments.map(toDocumentSummary),
    fee,
    portal: await (async () => {
      const portalUser = await prisma.user.findFirst({
        where: { clientUnitId: client.unitId, officeId: user.officeId },
        select: {
          unitId: true,
          isActive: true,
          pinHash: true,
          lastLoginAt: true,
          roles: true,
        },
      });
      if (!portalUser || !portalUser.roles.every((r) => r === "client")) {
        return {
          invited: false,
          isActive: false,
          userUnitId: null as string | null,
          hasPin: false,
          lastLoginAt: null as string | null,
        };
      }
      return {
        invited: true,
        isActive: portalUser.isActive,
        userUnitId: portalUser.unitId,
        hasPin: Boolean(portalUser.pinHash),
        lastLoginAt: portalUser.lastLoginAt?.toISOString() ?? null,
      };
    })(),
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "clients", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const client = unitId ? await prisma.client.findFirst({ where: { unitId, officeId: user.officeId } }) : null;
  if (!client) return jsonFail("NOT_FOUND", "Client not found", 404);

  const raw = await request.json();
  const parsed = updateClientSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  const before = pickAuditFields(client as Record<string, unknown>, CLIENT_AUDIT_KEYS);

  const portalUser = await prisma.user.findFirst({
    where: { clientUnitId: client.unitId, officeId: user.officeId },
  });
  const nextMobile =
    input.mobile !== undefined
      ? normalizeMobile(input.mobile) ?? client.mobile
      : undefined;
  if (
    portalUser &&
    portalUser.roles.every((r) => r === "client") &&
    nextMobile &&
    nextMobile !== portalUser.mobile
  ) {
    const clash = await prisma.user.findFirst({
      where: { mobile: nextMobile, officeId: user.officeId },
    });
    if (clash && clash.id !== portalUser.id) {
      return jsonFail(
        "CONFLICT",
        "This mobile is already a login for another user. Portal and client mobile must stay the same.",
        409
      );
    }
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      name: input.name,
      fatherOrSpouse:
        input.fatherOrSpouse === ""
          ? null
          : input.fatherOrSpouse !== undefined
            ? input.fatherOrSpouse
            : undefined,
      occupation:
        input.occupation === ""
          ? null
          : input.occupation !== undefined
            ? input.occupation
            : undefined,
      gender:
        input.gender === ""
          ? null
          : input.gender !== undefined
            ? input.gender
            : undefined,
      mobile: input.mobile ? normalizeMobile(input.mobile) ?? client.mobile : undefined,
      altMobile:
        input.altMobile === ""
          ? null
          : input.altMobile
            ? normalizeMobile(input.altMobile) ?? input.altMobile
            : undefined,
      email: input.email === "" ? null : input.email,
      address: input.address === "" ? null : input.address,
      city: input.city === "" ? null : input.city,
      district: input.district === "" ? null : input.district,
      state: input.state === "" ? null : input.state,
      aadhaarLast4: input.aadhaarLast4 === "" ? null : input.aadhaarLast4,
      referredBy:
        input.referredBy === ""
          ? null
          : input.referredBy !== undefined
            ? input.referredBy
            : undefined,
      matterBrief:
        input.matterBrief === ""
          ? null
          : input.matterBrief !== undefined
            ? input.matterBrief
            : undefined,
      notes: input.notes === "" ? null : input.notes,
      smsConsent: input.smsConsent,
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, CLIENT_AUDIT_KEYS);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "client.update",
    entity: "Client",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  // Keep linked portal login in sync (name / mobile / contact).
  if (portalUser && portalUser.roles.every((r) => r === "client")) {
    await prisma.user.update({
      where: { id: portalUser.id },
      data: {
        name: updated.name,
        ...(nextMobile ? { mobile: nextMobile } : {}),
        email: updated.email || undefined,
        address: updated.address || undefined,
      },
    });
  }

  return jsonOk({ client: toClientSummary(updated) });
});
