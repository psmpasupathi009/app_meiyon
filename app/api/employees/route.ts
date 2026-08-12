import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { checkSeatLimit } from "@/lib/auth/plan-gate";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { normalizeMobile } from "@/lib/auth/mobile";
import { createEmployeeSchema } from "@/lib/validations/employees.schema";
import { requireAdminToAssignAdmin } from "@/lib/rbac/employee-guards";
import { toEmployeeSummary } from "@/features/employees/server/serialize";
import type { Prisma } from "@prisma/client";
import { containsInsensitive } from "@/lib/db/search";

const EMPLOYEE_AUDIT_KEYS = [
  "name",
  "designation",
  "roles",
  "email",
  "address",
  "mobile",
  "isActive",
  "defaultCourts",
] as const;

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const q = searchParams.get("q")?.trim() ?? "";
  const digits = q.replace(/\D/g, "");
  const roleFilter = searchParams.get("role")?.trim();
  const statusFilter = searchParams.get("status")?.trim();

  const where: Prisma.UserWhereInput = {
    officeId: user.officeId,
    // Portal client logins are not office employees
    NOT: { roles: { equals: ["client"] } },
    ...(q
      ? {
          OR: [
            { name: containsInsensitive(q) },
            ...(digits ? [{ mobile: { contains: digits } }] : []),
            { unitId: containsInsensitive(q) },
            { designation: containsInsensitive(q) },
          ],
        }
      : {}),
    ...(roleFilter ? { roles: { has: roleFilter as never } } : {}),
    ...(statusFilter === "active"
      ? { isActive: true }
      : statusFilter === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOkList(rows.map(toEmployeeSummary), { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "create");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 400, parsed.error.issues);
  }
  const input = parsed.data;

  const guardMsg = requireAdminToAssignAdmin(user, input.roles);
  if (guardMsg) return jsonFail("FORBIDDEN", guardMsg, 403);

  const seats = await checkSeatLimit(user.officeId);
  if (!seats.allowed) {
    return jsonFail(
      "PLAN_REQUIRED",
      `Seat limit reached (${seats.activeSeats}/${seats.seatLimit}). Upgrade your plan on Billing.`,
      403
    );
  }

  const mobile = normalizeMobile(input.mobile);
  if (!mobile) {
    return jsonFail("VALIDATION", "Enter a valid 10-digit Indian mobile number", 400);
  }

  const existing = await prisma.user.findFirst({
    where: { mobile, officeId: user.officeId },
  });
  if (existing) {
    return jsonFail("CONFLICT", "This mobile number is already registered", 409);
  }

  const unitId = await nextUnitId("employee", user);

  const created = await prisma.user.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      mobile,
      roles: input.roles,
      name: input.name,
      designation: input.designation,
      email: input.email || undefined,
      address: input.address || undefined,
      defaultCourts: input.defaultCourts ?? [],
      createdById: user.id,
      isActive: true,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "employee.create",
    entity: "User",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, EMPLOYEE_AUDIT_KEYS),
    },
  });

  return jsonOk({ employee: toEmployeeSummary(created) }, 201);
});
