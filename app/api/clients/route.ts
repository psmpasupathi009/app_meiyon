import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { normalizeMobile } from "@/lib/auth/mobile";
import { createClientSchema } from "@/lib/validations/clients.schema";
import { toClientSummary } from "@/features/clients/server/serialize";
import { containsInsensitive } from "@/lib/db/search";

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

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "clients", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const q = searchParams.get("q")?.trim() ?? "";
  const digits = q.replace(/\D/g, "");

  const where: Prisma.ClientWhereInput = {
    officeId: user.officeId,
    ...(q
      ? {
          OR: [
            { name: containsInsensitive(q) },
            ...(digits ? [{ mobile: { contains: digits } }] : []),
            { unitId: containsInsensitive(q) },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        unitId: true,
        name: true,
        fatherOrSpouse: true,
        occupation: true,
        gender: true,
        mobile: true,
        altMobile: true,
        email: true,
        address: true,
        city: true,
        district: true,
        state: true,
        aadhaarLast4: true,
        referredBy: true,
        matterBrief: true,
        notes: true,
        smsConsent: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  return jsonOkList(rows.map(toClientSummary), { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "clients", "create");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createClientSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  const mobile = normalizeMobile(input.mobile);
  if (!mobile) {
    return jsonFail("VALIDATION", "Enter a valid 10-digit Indian mobile number", 400);
  }

  const unitId = await nextUnitId("client", user);
  const created = await prisma.client.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      name: input.name,
      fatherOrSpouse: input.fatherOrSpouse || undefined,
      occupation: input.occupation || undefined,
      gender: input.gender || undefined,
      mobile,
      altMobile: input.altMobile ? (normalizeMobile(input.altMobile) ?? input.altMobile) : undefined,
      email: input.email || undefined,
      address: input.address || undefined,
      city: input.city || undefined,
      district: input.district || undefined,
      state: input.state || undefined,
      aadhaarLast4: input.aadhaarLast4 || undefined,
      referredBy: input.referredBy || undefined,
      matterBrief: input.matterBrief || undefined,
      notes: input.notes || undefined,
      smsConsent: input.smsConsent ?? true,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "client.create",
    entity: "Client",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, CLIENT_AUDIT_KEYS),
    },
  });

  return jsonOk({ client: toClientSummary(created) }, 201);
});
