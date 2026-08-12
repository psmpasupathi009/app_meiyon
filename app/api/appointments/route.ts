import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import {
  canBookForAnyAdvocate,
  canViewAnyAdvocateDiary,
  resolveBookingAdvocateMobile,
} from "@/lib/appointments/booking-rules";
import { assertSlotBookable } from "@/lib/appointments/availability";
import { createAppointmentSchema } from "@/lib/validations/appointments.schema";
import { enrichAppointments, enrichAppointment } from "@/features/appointments/server/enrich";
import { containsInsensitive } from "@/lib/db/search";
import {
  findUsersByMobiles,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";
import { formatIstTime, istDisplayDate } from "@/lib/utils/ist";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  const advocateMobile = searchParams.get("advocateMobile")?.trim();

  const and: Prisma.AppointmentWhereInput[] = [];

  const clientScope = requireClientUnitId(user);
  if (isClientOnlyUser(user.roles)) {
    if (!clientScope) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    and.push({ clientUnitId: clientScope });
  } else {
    const scopeOwn = !canViewAnyAdvocateDiary(user.roles);
    const scopedMobile = scopeOwn
      ? user.mobile
      : advocateMobile || undefined;

    if (scopedMobile) {
      and.push({
        OR: [
          { advocateMobile: scopedMobile },
          {
            advocateMobile: `91${scopedMobile.replace(/\D/g, "").slice(-10)}`,
          },
          {
            advocateMobile: scopedMobile.replace(/\D/g, "").slice(-10),
          },
        ],
      });
    } else if (searchParams.get("unassigned") === "1") {
      and.push({
        OR: [{ advocateMobile: null }, { advocateMobile: "" }],
      });
    }
  }

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

  if (from || to) {
    and.push({
      scheduledAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    });
  }

  const where: Prisma.AppointmentWhereInput = {
    officeId: user.officeId,
    ...(status ? { status: status as never } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return jsonOkList(
    await enrichAppointments(rows, {
      stripNotes: isClientOnlyUser(user.roles),
    }),
    { page, pageSize, total }
  );
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "create");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const clientActor = isClientOnlyUser(user.roles);
  const actorClientUnitId = requireClientUnitId(user);

  if (clientActor) {
    if (!actorClientUnitId) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    if (input.mode === "video") {
      return jsonFail(
        "VALIDATION",
        "Clients can book office visit or phone call only",
        400
      );
    }
  }

  let clientId: string | undefined;
  let clientUnitId: string | undefined;
  if (clientActor) {
    const client = await prisma.client.findFirst({ where: { unitId: actorClientUnitId!, officeId: user.officeId },
      select: { id: true, unitId: true },
    });
    if (!client) return jsonFail("VALIDATION", "Client not found", 400);
    clientId = client.id;
    clientUnitId = client.unitId;
  } else if (input.clientUnitId) {
    const client = await prisma.client.findFirst({ where: { unitId: input.clientUnitId, officeId: user.officeId },
      select: { id: true, unitId: true },
    });
    if (!client) return jsonFail("VALIDATION", "Client not found", 400);
    clientId = client.id;
    clientUnitId = client.unitId;
  }

  let caseId: string | undefined;
  let caseUnitId: string | undefined;
  if (input.caseUnitId) {
    const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
      select: { id: true, unitId: true, clientUnitId: true },
    });
    if (!caseItem) return jsonFail("VALIDATION", "Case not found", 400);
    if (clientActor && caseItem.clientUnitId !== actorClientUnitId) {
      return jsonFail("NOT_FOUND", "Case not found", 404);
    }
    caseId = caseItem.id;
    caseUnitId = caseItem.unitId;
  }

  const resolved = resolveBookingAdvocateMobile({
    roles: user.roles,
    actorMobile: user.mobile,
    requestedMobile: input.advocateMobile,
  });
  if (!resolved.mobile) {
    return jsonFail("VALIDATION", resolved.error ?? "Select an advocate", 400);
  }

  if (canBookForAnyAdvocate(user.roles)) {
    const ten = resolved.mobile.replace(/\D/g, "").slice(-10);
    const advocate = await prisma.user.findFirst({
      where: {
        isActive: true,
        roles: { has: "advocate" },
        OR: [
          { mobile: resolved.mobile },
          { mobile: ten },
          { mobile: `91${ten}` },
        ],
      },
      select: { id: true },
    });
    if (!advocate) {
      return jsonFail(
        "VALIDATION",
        "Select an advocate from the office list",
        400
      );
    }
  }

  const bookable = await assertSlotBookable({
    advocateMobile: resolved.mobile,
    clientUnitId: clientUnitId || null,
    start: input.scheduledAt,
    durationMin: input.durationMin ?? 30,
  });
  if (!bookable.ok) {
    return jsonFail(bookable.code, bookable.message, 409);
  }

  const unitId = await nextUnitId("appointment", user);
  const created = await prisma.appointment.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      clientId,
      clientUnitId,
      caseId,
      caseUnitId,
      advocateMobile: resolved.mobile,
      title: input.title,
      scheduledAt: input.scheduledAt,
      durationMin: input.durationMin ?? 30,
      mode: input.mode ?? "office",
      location: input.location || undefined,
      notes: input.notes || undefined,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: clientActor ? "appointment.create.client" : "appointment.create",
    entity: "Appointment",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "title",
        "clientUnitId",
        "caseUnitId",
        "advocateMobile",
        "scheduledAt",
        "durationMin",
        "mode",
        "location",
        "notes",
        "status",
      ] as const),
    },
  });

  scheduleNotify(async () => {
    if (!created.advocateMobile) return;
    const advocates = await findUsersByMobiles(user.officeId, [created.advocateMobile]);
    await notifyUsers(
      advocates
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "appointment",
          title: clientActor
            ? `Client booked: ${created.title}`
            : `Appointment: ${created.title}`,
          body: `${istDisplayDate(created.scheduledAt)} · ${formatIstTime(created.scheduledAt)}`,
          href: "/appointments",
          meta: { appointmentUnitId: created.unitId },
        }))
    );
  });

  return jsonOk(
    {
      appointment: await enrichAppointment(created, {
        stripNotes: clientActor,
      }),
    },
    201
  );
});
