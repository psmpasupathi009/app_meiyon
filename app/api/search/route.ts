import { apiHandler, jsonOk, jsonFail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { containsInsensitive } from "@/lib/db/search";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const limited = await rateLimit(
    clientRateKey(request, "search", user.unitId),
    60,
    60 * 1000
  );
  if (!limited.allowed) {
    return jsonFail(
      "RATE_LIMITED",
      "Too many searches. Slow down a moment.",
      429
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return jsonOk({ employees: [], clients: [], cases: [] });
  }

  // Client portal: only own cases (no office-wide employee/client search).
  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    if (!isModuleEnabled("cases")) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }
    const cases = await prisma.case.findMany({
      where: {
        clientUnitId: cid,
        OR: [
          { unitId: containsInsensitive(q) },
          { caseNumber: containsInsensitive(q) },
          { filingNumber: containsInsensitive(q) },
          { courtName: containsInsensitive(q) },
          { opposingParty: containsInsensitive(q) },
        ],
      },
      take: 8,
      select: {
        unitId: true,
        caseNumber: true,
        status: true,
        opposingParty: true,
      },
    });
    return jsonOk({
      employees: [],
      clients: [],
      cases: cases.map((c) => ({
        unitId: c.unitId,
        caseNumber: c.caseNumber,
        status: c.status,
        opposingParty: c.opposingParty,
      })),
    });
  }

  const [canEmployees, canClients, canCases] = await Promise.all([
    isModuleEnabled("employees") &&
      hasPermission(user, "employees", "view"),
    isModuleEnabled("clients") && hasPermission(user, "clients", "view"),
    isModuleEnabled("cases") && hasPermission(user, "cases", "view"),
  ]);

  if (!canEmployees && !canClients && !canCases) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const digits = q.replace(/\D/g, "");

  const [employees, clients, cases] = await Promise.all([
    canEmployees
      ? prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { unitId: containsInsensitive(q) },
              { name: containsInsensitive(q) },
              ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : []),
            ],
          },
          take: 8,
          select: {
            unitId: true,
            name: true,
            mobile: true,
            designation: true,
          },
        })
      : Promise.resolve([]),
    canClients
      ? prisma.client.findMany({
          where: {
            OR: [
              { unitId: containsInsensitive(q) },
              { name: containsInsensitive(q) },
              ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : []),
            ],
          },
          take: 8,
          select: { unitId: true, name: true, mobile: true },
        })
      : Promise.resolve([]),
    canCases
      ? prisma.case.findMany({
          where: {
            OR: [
              { unitId: containsInsensitive(q) },
              { caseNumber: containsInsensitive(q) },
              { opposingParty: containsInsensitive(q) },
            ],
          },
          take: 8,
          select: {
            unitId: true,
            caseNumber: true,
            status: true,
            opposingParty: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return jsonOk({ employees, clients, cases });
});
