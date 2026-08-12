import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler, jsonFail } from "@/lib/api/response";
import { requirePerm, requireUser } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@meiyon/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import {
  buildAccountsWhere,
  parseAccountsFilters,
} from "@/features/accounts/server/filters";
import { resolveActorsByIds } from "@/features/accounts/server/actors";
import { FEE_PURPOSES } from "@/features/accounts/lib/payment-purposes";
import {
  buildExpensesWhere,
  parseExpensesFilters,
} from "@/features/expenses/server/filters";
import { resolveExpenseActorsByIds } from "@/features/expenses/server/actors";
import {
  categoryLabel,
  paymentModeLabel,
} from "@/features/expenses/server/serialize";
import {
  buildCaseListWhere,
  parseCaseListFilters,
} from "@/features/cases/server/filters";
import { istDateKey, istDayBounds, formatIstTime } from "@/lib/utils/ist";
import { displayMobile } from "@/lib/auth/mobile";
import { containsInsensitive } from "@/lib/db/search";
import { isModuleEnabled } from "@meiyon/config";
import {
  attendanceQueryScope,
  isInvalidAttendanceDateRange,
  parseAttendanceUserUnitIds,
} from "@/features/hrms/lib/attendance-scope";

export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "cases";

  const limited = await rateLimit(
    clientRateKey(request, "export"),
    10,
    15 * 60 * 1000
  );
  if (!limited.allowed) {
    return jsonFail(
      "RATE_LIMITED",
      "Too many exports. Try again in a few minutes.",
      429
    );
  }

  // Attendance can be exported from HRMS without reports.view;
  // other export types still require the Reports module.
  if (type !== "attendance") {
    const reportsGate = await requirePerm(request, "reports", "view");
    if (!reportsGate.user) return reportsGate.response;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MLF";

  if (type === "attendance") {
    if (!isModuleEnabled("hrms")) {
      return jsonFail("FORBIDDEN", "This module is not available", 403);
    }
    const { user, response } = await requireUser(request);
    if (!user) return response;

    const [canOwn, canManage] = await Promise.all([
      hasPermission(user, "hrms", "own_attendance"),
      hasPermission(user, "hrms", "manage_attendance"),
    ]);
    if (!canOwn && !canManage) {
      return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
    }

    const from =
      url.searchParams.get("from")?.trim() ||
      istDateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = url.searchParams.get("to")?.trim() || istDateKey();
    if (isInvalidAttendanceDateRange(from, to)) {
      return jsonFail("VALIDATION", "from must be on/before to", 400);
    }

    const all =
      url.searchParams.get("all") === "1" ||
      url.searchParams.get("all") === "true";
    const mine =
      url.searchParams.get("mine") === "1" ||
      url.searchParams.get("mine") === "true";
    const userUnitIds = parseAttendanceUserUnitIds(url.searchParams);

    const scope = attendanceQueryScope({
      canManage,
      all,
      mine,
      userUnitIds,
      userId: user.id,
    });

    const rows = await prisma.attendance.findMany({
      where: {
        ...scope,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: "desc" }, { userUnitId: "asc" }],
      take: 5000,
    });

    const unitIds = Array.from(new Set(rows.map((r) => r.userUnitId)));
    const people = unitIds.length
      ? await prisma.user.findMany({
          where: { unitId: { in: unitIds } },
          select: { unitId: true, name: true, mobile: true },
        })
      : [];
    const personByUnit = new Map(people.map((p) => [p.unitId, p]));

    const sheet = workbook.addWorksheet("Attendance");
    sheet.columns = [
      { header: "date", key: "date", width: 12 },
      { header: "employeeUnitId", key: "employeeUnitId", width: 14 },
      { header: "name", key: "name", width: 24 },
      { header: "mobile", key: "mobile", width: 14 },
      { header: "checkIn", key: "checkIn", width: 10 },
      { header: "checkOut", key: "checkOut", width: 10 },
      { header: "checkInAt", key: "checkInAt", width: 22 },
      { header: "checkOutAt", key: "checkOutAt", width: 22 },
      { header: "checkInLat", key: "checkInLat", width: 12 },
      { header: "checkInLng", key: "checkInLng", width: 12 },
      { header: "checkOutLat", key: "checkOutLat", width: 12 },
      { header: "checkOutLng", key: "checkOutLng", width: 12 },
      { header: "status", key: "status", width: 14 },
      { header: "notes", key: "notes", width: 28 },
    ];

    for (const r of rows) {
      const person = personByUnit.get(r.userUnitId);
      const status = r.checkOutAt
        ? "checked_out"
        : r.checkInAt
          ? "present"
          : "—";
      sheet.addRow({
        date: r.date,
        employeeUnitId: r.userUnitId,
        name: person?.name ?? "",
        mobile: person?.mobile ? displayMobile(person.mobile) : "",
        checkIn: r.checkInAt ? formatIstTime(r.checkInAt) : "",
        checkOut: r.checkOutAt ? formatIstTime(r.checkOutAt) : "",
        checkInAt: r.checkInAt?.toISOString() ?? "",
        checkOutAt: r.checkOutAt?.toISOString() ?? "",
        checkInLat: r.checkInLat ?? "",
        checkInLng: r.checkInLng ?? "",
        checkOutLat: r.checkOutLat ?? "",
        checkOutLng: r.checkOutLng ?? "",
        status,
        notes: r.notes ?? "",
      });
    }
  } else if (type === "cases") {
    const { user, response } = await requirePerm(request, "cases", "view");
    if (!user) return response;
    const where = buildCaseListWhere(parseCaseListFilters(url.searchParams));
    const rows = await prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const sheet = workbook.addWorksheet("Cases");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "caseNumber", key: "caseNumber", width: 18 },
      { header: "clientUnitId", key: "clientUnitId", width: 14 },
      { header: "status", key: "status", width: 12 },
      { header: "opposingParty", key: "opposingParty", width: 24 },
      { header: "courtName", key: "courtName", width: 24 },
      { header: "nextHearingAt", key: "nextHearingAt", width: 20 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        caseNumber: r.caseNumber ?? "",
        clientUnitId: r.clientUnitId,
        status: r.status,
        opposingParty: r.opposingParty ?? "",
        courtName: r.courtName ?? "",
        nextHearingAt: r.nextHearingAt?.toISOString() ?? "",
      });
    }
  } else if (type === "clients") {
    const { user, response } = await requirePerm(request, "clients", "view");
    if (!user) return response;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const rows = await prisma.client.findMany({
      where: q
        ? {
            OR: [
              { name: containsInsensitive(q) },
              { unitId: containsInsensitive(q) },
              { mobile: { contains: q } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const sheet = workbook.addWorksheet("Clients");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "name", key: "name", width: 24 },
      { header: "mobile", key: "mobile", width: 14 },
      { header: "email", key: "email", width: 24 },
      { header: "city", key: "city", width: 16 },
      { header: "district", key: "district", width: 16 },
      { header: "state", key: "state", width: 16 },
      { header: "smsConsent", key: "smsConsent", width: 12 },
      { header: "referredBy", key: "referredBy", width: 18 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        name: r.name,
        mobile: displayMobile(r.mobile),
        email: r.email ?? "",
        city: r.city ?? "",
        district: r.district ?? "",
        state: r.state ?? "",
        smsConsent: r.smsConsent ? "true" : "false",
        referredBy: r.referredBy ?? "",
      });
    }
  } else if (type === "employees") {
    const { user, response } = await requirePerm(request, "employees", "view");
    if (!user) return response;
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        unitId: true,
        name: true,
        mobile: true,
        email: true,
        designation: true,
        roles: true,
        isActive: true,
        defaultCourts: true,
      },
    });
    const sheet = workbook.addWorksheet("Employees");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "name", key: "name", width: 24 },
      { header: "mobile", key: "mobile", width: 14 },
      { header: "email", key: "email", width: 24 },
      { header: "designation", key: "designation", width: 20 },
      { header: "roles", key: "roles", width: 24 },
      { header: "isActive", key: "isActive", width: 10 },
      { header: "defaultState", key: "defaultState", width: 16 },
      { header: "defaultDistrict", key: "defaultDistrict", width: 16 },
      { header: "defaultCity", key: "defaultCity", width: 16 },
      { header: "defaultCourtNames", key: "defaultCourtNames", width: 40 },
    ];
    const { parseDefaultCourts } = await import("@/lib/hearings/court-key");
    for (const r of rows) {
      const courts = parseDefaultCourts(r.defaultCourts);
      const first = courts[0];
      sheet.addRow({
        unitId: r.unitId,
        name: r.name ?? "",
        mobile: displayMobile(r.mobile),
        email: r.email ?? "",
        designation: r.designation ?? "",
        roles: r.roles.join("|"),
        isActive: r.isActive ? "true" : "false",
        defaultState: first?.state ?? "",
        defaultDistrict: first?.district ?? "",
        defaultCity: first?.city ?? "",
        defaultCourtNames: courts.map((c) => c.courtName).join("|"),
      });
    }
  } else if (type === "tasks") {
    const { user, response } = await requirePerm(request, "tasks", "view");
    if (!user) return response;
    const workDate = url.searchParams.get("workDate")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const kind = url.searchParams.get("kind")?.trim();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const due = url.searchParams.get("due")?.trim();
    const todayKey = istDateKey();
    const { start: todayStart, end: todayEnd } = istDayBounds(todayKey);
    const and: Prisma.OfficeTaskWhereInput[] = [];
    if (due === "overdue") {
      and.push({
        OR: [
          { dueDate: { lt: todayStart } },
          { AND: [{ dueDate: null }, { workDate: { lt: todayStart } }] },
        ],
      });
    } else if (due === "today") {
      and.push({
        OR: [
          { dueDate: { gte: todayStart, lte: todayEnd } },
          { workDate: { gte: todayStart, lte: todayEnd } },
        ],
      });
    }
    if (q) {
      and.push({
        OR: [
          { title: containsInsensitive(q) },
          { notes: containsInsensitive(q) },
          { finishNote: containsInsensitive(q) },
          { unitId: containsInsensitive(q) },
          { caseUnitId: containsInsensitive(q) },
          { assigneeUnitId: containsInsensitive(q) },
        ],
      });
    }
    const where: Prisma.OfficeTaskWhereInput = {
      ...(status ? { status } : due ? { status: "open" } : {}),
      ...(kind ? { kind } : {}),
      ...(workDate && !due
        ? (() => {
            const { start, end } = istDayBounds(workDate);
            return { workDate: { gte: start, lte: end } };
          })()
        : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const rows = await prisma.officeTask.findMany({
      where,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });
    const sheet = workbook.addWorksheet("Tasks");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "title", key: "title", width: 32 },
      { header: "kind", key: "kind", width: 14 },
      { header: "status", key: "status", width: 12 },
      { header: "workDate", key: "workDate", width: 14 },
      { header: "dueDate", key: "dueDate", width: 14 },
      { header: "assigneeUnitId", key: "assigneeUnitId", width: 14 },
      { header: "caseUnitId", key: "caseUnitId", width: 14 },
      { header: "notes", key: "notes", width: 28 },
      { header: "finishNote", key: "finishNote", width: 28 },
      { header: "completedAt", key: "completedAt", width: 20 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        title: r.title,
        kind: r.kind,
        status: r.status,
        workDate: r.workDate?.toISOString().slice(0, 10) ?? "",
        dueDate: r.dueDate?.toISOString().slice(0, 10) ?? "",
        assigneeUnitId: r.assigneeUnitId ?? "",
        caseUnitId: r.caseUnitId ?? "",
        notes: r.notes ?? "",
        finishNote: r.finishNote ?? "",
        completedAt: r.completedAt?.toISOString() ?? "",
      });
    }
  } else if (type === "dak") {
    const { user, response } = await requirePerm(request, "dak", "view");
    if (!user) return response;
    const direction = url.searchParams.get("direction")?.trim();
    const dateKey = url.searchParams.get("date")?.trim();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const where: Prisma.DakEntryWhereInput = {
      ...(direction === "in" || direction === "out" ? { direction } : {}),
      ...(dateKey
        ? (() => {
            const { start, end } = istDayBounds(dateKey);
            return { entryDate: { gte: start, lte: end } };
          })()
        : {}),
      ...(q
        ? {
            OR: [
              { subject: containsInsensitive(q) },
              { fromTo: containsInsensitive(q) },
              { trackingNo: containsInsensitive(q) },
              { notes: containsInsensitive(q) },
              { unitId: containsInsensitive(q) },
              { caseUnitId: containsInsensitive(q) },
              { clientUnitId: containsInsensitive(q) },
            ],
          }
        : {}),
    };
    const rows = await prisma.dakEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });
    const sheet = workbook.addWorksheet("Dak");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "direction", key: "direction", width: 10 },
      { header: "entryDate", key: "entryDate", width: 14 },
      { header: "subject", key: "subject", width: 32 },
      { header: "fromTo", key: "fromTo", width: 24 },
      { header: "mode", key: "mode", width: 12 },
      { header: "trackingNo", key: "trackingNo", width: 16 },
      { header: "caseUnitId", key: "caseUnitId", width: 14 },
      { header: "clientUnitId", key: "clientUnitId", width: 14 },
      { header: "notes", key: "notes", width: 28 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        direction: r.direction,
        entryDate: r.entryDate.toISOString().slice(0, 10),
        subject: r.subject,
        fromTo: r.fromTo ?? "",
        mode: r.mode ?? "",
        trackingNo: r.trackingNo ?? "",
        caseUnitId: r.caseUnitId ?? "",
        clientUnitId: r.clientUnitId ?? "",
        notes: r.notes ?? "",
      });
    }
  } else if (type === "accounts") {
    const { user, response } = await requirePerm(request, "accounts", "view");
    if (!user) return response;

    const filters = parseAccountsFilters(url.searchParams);
    let matchingClientUnitIds: string[] | undefined;
    if (filters.q) {
      const clients = await prisma.client.findMany({
        where: { name: { contains: filters.q } },
        select: { unitId: true },
        take: 100,
      });
      matchingClientUnitIds = clients.map((c) => c.unitId);
    }
    const where = buildAccountsWhere({ ...filters, matchingClientUnitIds });

    const rows = await prisma.cashPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const clientIds = Array.from(new Set(rows.map((r) => r.clientUnitId)));
    const [clients, actorMap] = await Promise.all([
      prisma.client.findMany({
        where: { unitId: { in: clientIds } },
        select: { unitId: true, name: true },
      }),
      resolveActorsByIds(rows.flatMap((r) => [r.createdById, r.voidedById])),
    ]);
    const clientMap = new Map(clients.map((c) => [c.unitId, c.name]));

    const sheet = workbook.addWorksheet("Payments");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "clientUnitId", key: "clientUnitId", width: 14 },
      { header: "clientName", key: "clientName", width: 24 },
      { header: "caseUnitId", key: "caseUnitId", width: 14 },
      { header: "purpose", key: "purpose", width: 14 },
      { header: "amount", key: "amount", width: 12 },
      { header: "status", key: "status", width: 12 },
      { header: "paidOn", key: "paidOn", width: 20 },
      { header: "notes", key: "notes", width: 32 },
      { header: "voidedAt", key: "voidedAt", width: 20 },
      { header: "voidReason", key: "voidReason", width: 28 },
      { header: "createdAt", key: "createdAt", width: 20 },
      { header: "createdByUnitId", key: "createdByUnitId", width: 14 },
      { header: "voidedByUnitId", key: "voidedByUnitId", width: 14 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        clientUnitId: r.clientUnitId,
        clientName: clientMap.get(r.clientUnitId) ?? "",
        caseUnitId: r.caseUnitId ?? "",
        purpose: r.type,
        amount: r.amount,
        status: r.status,
        paidOn: r.paidOn?.toISOString() ?? "",
        notes: r.notes ?? "",
        voidedAt: r.voidedAt?.toISOString() ?? "",
        voidReason: r.voidReason ?? "",
        createdAt: r.createdAt.toISOString(),
        createdByUnitId: r.createdById
          ? actorMap.get(r.createdById)?.unitId ?? ""
          : "",
        voidedByUnitId: r.voidedById
          ? actorMap.get(r.voidedById)?.unitId ?? ""
          : "",
      });
    }
  } else if (type === "expenses") {
    if (!isModuleEnabled("expenses")) {
      return jsonFail("FORBIDDEN", "This module is not available", 403);
    }
    const { user, response } = await requirePerm(request, "expenses", "view");
    if (!user) return response;

    const filters = parseExpensesFilters(url.searchParams);
    const where = buildExpensesWhere(filters);
    const rows = await prisma.officeExpense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });
    const actorMap = await resolveExpenseActorsByIds(
      rows.flatMap((r) => [r.createdById, r.voidedById])
    );

    const sheet = workbook.addWorksheet("Office expenses");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "expenseDate", key: "expenseDate", width: 14 },
      { header: "category", key: "category", width: 20 },
      { header: "vendor", key: "vendor", width: 22 },
      { header: "description", key: "description", width: 36 },
      { header: "amount", key: "amount", width: 12 },
      { header: "paymentMode", key: "paymentMode", width: 14 },
      { header: "billDocumentUnitId", key: "billDocumentUnitId", width: 16 },
      { header: "voidedAt", key: "voidedAt", width: 20 },
      { header: "voidReason", key: "voidReason", width: 28 },
      { header: "createdAt", key: "createdAt", width: 20 },
      { header: "createdByUnitId", key: "createdByUnitId", width: 14 },
      { header: "voidedByUnitId", key: "voidedByUnitId", width: 14 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        expenseDate: istDateKey(r.expenseDate),
        category: categoryLabel(r.category),
        vendor: r.vendor ?? "",
        description: r.description,
        amount: r.amount,
        paymentMode: paymentModeLabel(r.paymentMode),
        billDocumentUnitId: r.billDocumentUnitId ?? "",
        voidedAt: r.voidedAt?.toISOString() ?? "",
        voidReason: r.voidReason ?? "",
        createdAt: r.createdAt.toISOString(),
        createdByUnitId: r.createdById
          ? actorMap.get(r.createdById)?.unitId ?? ""
          : "",
        voidedByUnitId: r.voidedById
          ? actorMap.get(r.voidedById)?.unitId ?? ""
          : "",
      });
    }
  } else if (type === "appointments") {
    const { user, response } = await requirePerm(request, "appointments", "view");
    if (!user) return response;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim();
    const from = url.searchParams.get("from")?.trim();
    const to = url.searchParams.get("to")?.trim();
    const advocateMobile = url.searchParams.get("advocateMobile")?.trim();
    const unassigned = url.searchParams.get("unassigned") === "1";
    const and: Prisma.AppointmentWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { title: containsInsensitive(q) },
          { unitId: containsInsensitive(q) },
          { clientUnitId: containsInsensitive(q) },
          { caseUnitId: containsInsensitive(q) },
          { notes: containsInsensitive(q) },
          { location: containsInsensitive(q) },
          { advocateMobile: containsInsensitive(q) },
        ],
      });
    }
    if (advocateMobile) {
      and.push({
        OR: [
          { advocateMobile },
          { advocateMobile: `91${advocateMobile.replace(/\D/g, "").slice(-10)}` },
          { advocateMobile: advocateMobile.replace(/\D/g, "").slice(-10) },
        ],
      });
    } else if (unassigned) {
      and.push({ OR: [{ advocateMobile: null }, { advocateMobile: "" }] });
    }
    if (from || to) {
      and.push({
        scheduledAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      });
    }
    const where: Prisma.AppointmentWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: 5000,
    });
    const sheet = workbook.addWorksheet("Appointments");
    sheet.columns = [
      { header: "unitId", key: "unitId", width: 14 },
      { header: "title", key: "title", width: 28 },
      { header: "scheduledAt", key: "scheduledAt", width: 22 },
      { header: "durationMin", key: "durationMin", width: 12 },
      { header: "mode", key: "mode", width: 10 },
      { header: "status", key: "status", width: 12 },
      { header: "advocateMobile", key: "advocateMobile", width: 14 },
      { header: "clientUnitId", key: "clientUnitId", width: 14 },
      { header: "caseUnitId", key: "caseUnitId", width: 14 },
      { header: "location", key: "location", width: 20 },
      { header: "notes", key: "notes", width: 28 },
    ];
    for (const r of rows) {
      sheet.addRow({
        unitId: r.unitId,
        title: r.title,
        scheduledAt: r.scheduledAt.toISOString(),
        durationMin: r.durationMin,
        mode: r.mode,
        status: r.status,
        advocateMobile: r.advocateMobile ? displayMobile(r.advocateMobile) : "",
        clientUnitId: r.clientUnitId ?? "",
        caseUnitId: r.caseUnitId ?? "",
        location: r.location ?? "",
        notes: r.notes ?? "",
      });
    }
  } else if (type === "fees-outstanding") {
    const { user, response } = await requirePerm(request, "accounts", "view");
    if (!user) return response;
    const canReports = await hasPermission(user, "reports", "view");
    if (!canReports) {
      return jsonFail("FORBIDDEN", "Reports permission required", 403);
    }

    const cases = await prisma.case.findMany({
      where: { agreedFee: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 5000,
      select: {
        unitId: true,
        caseNumber: true,
        clientUnitId: true,
        status: true,
        courtName: true,
        agreedFee: true,
      },
    });

    const caseUnitIds = cases.map((c) => c.unitId);
    const paidRows = caseUnitIds.length
      ? await prisma.cashPayment.groupBy({
          by: ["caseUnitId"],
          where: {
            caseUnitId: { in: caseUnitIds },
            status: "paid",
            type: { in: [...FEE_PURPOSES] },
          },
          _sum: { amount: true },
        })
      : [];
    const collectedMap = new Map(
      paidRows
        .filter((r) => r.caseUnitId)
        .map((r) => [r.caseUnitId as string, r._sum.amount ?? 0])
    );

    const clientIds = Array.from(new Set(cases.map((c) => c.clientUnitId)));
    const clients = await prisma.client.findMany({
      where: { unitId: { in: clientIds } },
      select: { unitId: true, name: true },
    });
    const clientMap = new Map(clients.map((c) => [c.unitId, c.name]));

    const sheet = workbook.addWorksheet("Fees outstanding");
    sheet.columns = [
      { header: "caseUnitId", key: "caseUnitId", width: 14 },
      { header: "caseNumber", key: "caseNumber", width: 18 },
      { header: "clientUnitId", key: "clientUnitId", width: 14 },
      { header: "clientName", key: "clientName", width: 24 },
      { header: "status", key: "status", width: 14 },
      { header: "courtName", key: "courtName", width: 24 },
      { header: "agreedFee", key: "agreedFee", width: 12 },
      { header: "collected", key: "collected", width: 12 },
      { header: "outstanding", key: "outstanding", width: 12 },
    ];
    for (const c of cases) {
      const agreed = c.agreedFee ?? 0;
      const collected = collectedMap.get(c.unitId) ?? 0;
      const outstanding = Math.max(0, agreed - collected);
      sheet.addRow({
        caseUnitId: c.unitId,
        caseNumber: c.caseNumber ?? "",
        clientUnitId: c.clientUnitId,
        clientName: clientMap.get(c.clientUnitId) ?? "",
        status: c.status,
        courtName: c.courtName ?? "",
        agreedFee: agreed,
        collected,
        outstanding,
      });
    }
  } else {
    return jsonFail("VALIDATION", "Unknown export type", 400);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mlf-${type}.xlsx"`,
    },
  });
});
