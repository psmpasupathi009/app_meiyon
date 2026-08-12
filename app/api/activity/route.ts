import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { containsInsensitive } from "@/lib/db/search";
import { decodeOpaqueId, encodeOpaqueId } from "@/lib/ids/opaque";
import { istDayBounds } from "@/lib/utils/ist";

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "activity", "view");
  if (!user) return response;

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
    : 40;
  const cursorRaw = url.searchParams.get("cursor")?.trim() || null;
  const entity = url.searchParams.get("entity")?.trim() || null;
  const actorUnitId = url.searchParams.get("actorUnitId")?.trim() || null;
  const action = url.searchParams.get("action")?.trim() || null;
  const from = url.searchParams.get("from")?.trim() || null;
  const to = url.searchParams.get("to")?.trim() || null;
  const q = url.searchParams.get("q")?.trim() || null;

  if (from && !isYmd(from)) {
    return jsonFail("VALIDATION", "from must be YYYY-MM-DD", 400);
  }
  if (to && !isYmd(to)) {
    return jsonFail("VALIDATION", "to must be YYYY-MM-DD", 400);
  }
  if (from && to && from > to) {
    return jsonFail("VALIDATION", "from must be on/before to", 400);
  }

  let cursorId: string | null = null;
  if (cursorRaw) {
    cursorId = decodeOpaqueId(cursorRaw);
    if (!cursorId) {
      return jsonFail("VALIDATION", "cursor must be a valid id", 400);
    }
  }

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entity = entity;
  if (actorUnitId) where.actorUnitId = actorUnitId;
  if (action) where.action = containsInsensitive(action);
  if (q) {
    const needle = containsInsensitive(q);
    where.OR = [
      { action: needle },
      { entity: needle },
      { entityUnitId: needle },
      { actorUnitId: needle },
    ];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = istDayBounds(from).start;
    if (to) where.createdAt.lte = istDayBounds(to).end;
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1,
        }
      : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const lastId = hasMore ? page[page.length - 1]?.id ?? null : null;
  const nextCursor = lastId ? encodeOpaqueId(lastId) : null;

  const actorUnitIds = Array.from(
    new Set(
      page
        .map((r) => r.actorUnitId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const actors = actorUnitIds.length
    ? await prisma.user.findMany({
        where: { unitId: { in: actorUnitIds } },
        select: { unitId: true, name: true },
      })
    : [];
  const actorByUnit = new Map(actors.map((a) => [a.unitId, a.name]));

  return jsonOk({
    data: page.map((row) => ({
      id: encodeOpaqueId(row.id),
      action: row.action,
      entity: row.entity,
      entityUnitId: row.entityUnitId,
      actorUnitId: row.actorUnitId,
      actorName: row.actorUnitId
        ? (actorByUnit.get(row.actorUnitId) ?? null)
        : null,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: {
      limit,
      nextCursor,
      hasMore,
    },
  });
});
