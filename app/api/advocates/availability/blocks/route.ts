import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { resolveAvailabilityTarget } from "@/lib/appointments/resolve-target";
import { createTimeBlockSchema } from "@/lib/validations/availability.schema";

function toBlock(b: {
  unitId: string;
  userUnitId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  reason: string | null;
}) {
  return {
    unitId: b.unitId,
    userUnitId: b.userUnitId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    kind: b.kind,
    reason: b.reason,
  };
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const target = await resolveAvailabilityTarget(
    user,
    searchParams.get("userUnitId")
  );
  if (!target.user) {
    return jsonFail("FORBIDDEN", target.error ?? "Forbidden", 403);
  }

  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const fromOk = fromDate && !Number.isNaN(fromDate.getTime());
  const toOk = toDate && !Number.isNaN(toDate.getTime());

  const where = {
    userId: target.user.id,
    ...(fromOk || toOk
      ? {
          // Overlap filter: starts before window end AND ends after window start
          ...(toOk ? { startsAt: { lt: toDate! } } : {}),
          ...(fromOk ? { endsAt: { gt: fromDate! } } : {}),
        }
      : { endsAt: { gte: new Date() } }),
  };

  const [rows, total] = await Promise.all([
    prisma.advocateTimeBlock.findMany({
      where,
      orderBy: { startsAt: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.advocateTimeBlock.count({ where }),
  ]);

  return jsonOkList(rows.map(toBlock), { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "edit");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createTimeBlockSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }

  const target = await resolveAvailabilityTarget(user, parsed.data.userUnitId);
  if (!target.user) {
    return jsonFail("FORBIDDEN", target.error ?? "Forbidden", 403);
  }

  const unitId = await nextUnitId("timeBlock", user);
  const created = await prisma.advocateTimeBlock.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      userId: target.user.id,
      userUnitId: target.user.unitId,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      kind: parsed.data.kind,
      reason: parsed.data.reason || undefined,
    },
  });

  return jsonOk({ block: toBlock(created) }, 201);
});
