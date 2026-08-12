import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { writeAudit, pickAuditFields, diffAudit } from "@/lib/audit";
import {
  canBookForAnyAdvocate,
  canViewAnyAdvocateDiary,
  resolveBookingAdvocateMobile,
} from "@/lib/appointments/booking-rules";
import { assertSlotBookable } from "@/lib/appointments/availability";
import { updateAppointmentSchema } from "@/lib/validations/appointments.schema";
import { enrichAppointment } from "@/features/appointments/server/enrich";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";
import type { UserRole } from "@prisma/client";

const APPOINTMENT_AUDIT_KEYS = [
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
] as const;

function canAccessAppointment(
  user: {
    roles: UserRole[];
    mobile: string;
    clientUnitId?: string | null;
  },
  item: { advocateMobile: string | null; clientUnitId: string | null }
): boolean {
  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    return Boolean(cid && item.clientUnitId === cid);
  }
  if (canViewAnyAdvocateDiary(user.roles)) return true;
  const ten = user.mobile.replace(/\D/g, "").slice(-10);
  const aptTen = (item.advocateMobile ?? "").replace(/\D/g, "").slice(-10);
  return !aptTen || aptTen === ten;
}

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "appointments", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.appointment.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Appointment not found", 404);

  if (!canAccessAppointment(user, item)) {
    return jsonFail("NOT_FOUND", "Appointment not found", 404);
  }

  return jsonOk({
    appointment: await enrichAppointment(item, {
      stripNotes: isClientOnlyUser(user.roles),
    }),
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const raw = await request.json();
  const parsed = updateAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const action = input.status === "cancelled" ? "cancel" : "edit";
  const { user, response } = await requirePerm(request, "appointments", action);
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  const item = unitId
    ? await prisma.appointment.findFirst({ where: { unitId, officeId: user.officeId } })
    : null;
  if (!item) return jsonFail("NOT_FOUND", "Appointment not found", 404);

  if (!canAccessAppointment(user, item)) {
    return jsonFail("NOT_FOUND", "Appointment not found", 404);
  }

  if (isClientOnlyUser(user.roles)) {
    if (action !== "cancel" || input.status !== "cancelled") {
      return jsonFail(
        "FORBIDDEN",
        "Clients can cancel appointments only. Contact the office to reschedule.",
        403
      );
    }
    if (item.status !== "scheduled") {
      return jsonFail(
        "VALIDATION",
        "Only scheduled appointments can be cancelled",
        400
      );
    }
    const updated = await prisma.appointment.update({
      where: { id: item.id },
      data: { status: "cancelled" },
    });
    const before = pickAuditFields(
      item as Record<string, unknown>,
      APPOINTMENT_AUDIT_KEYS
    );
    const after = pickAuditFields(
      updated as Record<string, unknown>,
      APPOINTMENT_AUDIT_KEYS
    );
    await writeAudit({
      officeId: user.officeId,
      actorUnitId: user.unitId,
      action: "appointment.cancel",
      entity: "Appointment",
      entityUnitId: updated.unitId,
      meta: { before, after, changes: diffAudit(before, after) },
    });
    return jsonOk({
      appointment: await enrichAppointment(updated, { stripNotes: true }),
    });
  }

  let clientId: string | null | undefined = undefined;
  let clientUnitId: string | null | undefined = undefined;
  if (input.clientUnitId !== undefined) {
    if (input.clientUnitId === "") {
      clientId = null;
      clientUnitId = null;
    } else {
      const client = await prisma.client.findFirst({ where: { unitId: input.clientUnitId, officeId: user.officeId },
        select: { id: true, unitId: true },
      });
      if (!client) return jsonFail("VALIDATION", "Client not found", 400);
      clientId = client.id;
      clientUnitId = client.unitId;
    }
  }

  let caseId: string | null | undefined = undefined;
  let caseUnitId: string | null | undefined = undefined;
  if (input.caseUnitId !== undefined) {
    if (input.caseUnitId === "") {
      caseId = null;
      caseUnitId = null;
    } else {
      const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
        select: { id: true, unitId: true },
      });
      if (!caseItem) return jsonFail("VALIDATION", "Case not found", 400);
      caseId = caseItem.id;
      caseUnitId = caseItem.unitId;
    }
  }

  let advocateMobile: string | null | undefined = undefined;
  if (input.advocateMobile !== undefined) {
    if (input.advocateMobile === "") {
      advocateMobile = null;
    } else {
      const resolved = resolveBookingAdvocateMobile({
        roles: user.roles,
        actorMobile: user.mobile,
        requestedMobile: input.advocateMobile,
      });
      if (!resolved.mobile) {
        return jsonFail(
          "VALIDATION",
          resolved.error ?? "Select an advocate",
          400
        );
      }
      advocateMobile = resolved.mobile;
    }
  } else if (!canBookForAnyAdvocate(user.roles)) {
    advocateMobile = resolveBookingAdvocateMobile({
      roles: user.roles,
      actorMobile: user.mobile,
    }).mobile;
  }

  const nextStatus = input.status ?? item.status;
  const nextStart = input.scheduledAt ?? item.scheduledAt;
  const nextDuration = input.durationMin ?? item.durationMin;
  const nextAdvocate =
    advocateMobile !== undefined ? advocateMobile : item.advocateMobile;
  const nextClient =
    clientUnitId !== undefined ? clientUnitId : item.clientUnitId;

  if (
    nextStatus === "scheduled" &&
    nextAdvocate &&
    (input.scheduledAt !== undefined ||
      input.durationMin !== undefined ||
      input.advocateMobile !== undefined ||
      input.clientUnitId !== undefined ||
      input.status === "scheduled")
  ) {
    const bookable = await assertSlotBookable({
      advocateMobile: nextAdvocate,
      clientUnitId: nextClient,
      start: nextStart,
      durationMin: nextDuration,
      excludeAppointmentUnitId: item.unitId,
    });
    if (!bookable.ok) {
      return jsonFail(bookable.code, bookable.message, 409);
    }
  }

  const before = pickAuditFields(item as Record<string, unknown>, APPOINTMENT_AUDIT_KEYS);

  const updated = await prisma.appointment.update({
    where: { id: item.id },
    data: {
      ...(input.clientUnitId !== undefined ? { clientId, clientUnitId } : {}),
      ...(input.caseUnitId !== undefined ? { caseId, caseUnitId } : {}),
      advocateMobile,
      title: input.title,
      scheduledAt: input.scheduledAt,
      durationMin: input.durationMin,
      mode: input.mode,
      location: input.location === "" ? null : input.location,
      notes: input.notes === "" ? null : input.notes,
      status: input.status,
    },
  });

  const after = pickAuditFields(updated as Record<string, unknown>, APPOINTMENT_AUDIT_KEYS);
  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action:
      input.status === "cancelled"
        ? "appointment.cancel"
        : "appointment.update",
    entity: "Appointment",
    entityUnitId: updated.unitId,
    meta: { before, after, changes: diffAudit(before, after) },
  });

  const { scheduleNotify, notifyUsers, findUsersByMobiles } = await import(
    "@/lib/notifications/notify"
  );
  const { istDisplayDate, formatIstTime } = await import("@/lib/utils/ist");
  scheduleNotify(async () => {
    const mob = updated.advocateMobile;
    if (!mob) return;
    const recipients = await findUsersByMobiles(user.officeId, [mob]);
    const cancelled = updated.status === "cancelled";
    const title = cancelled
      ? "Appointment cancelled"
      : "Appointment updated";
    const type = cancelled ? "appointment_cancelled" : "appointment_updated";
    await notifyUsers(
      recipients
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          officeId: user.officeId,
          officeUnitId: user.officeUnitId,
          userId: u.id,
          userUnitId: u.unitId,
          type,
          title,
          body: `${updated.title} · ${istDisplayDate(updated.scheduledAt)} ${formatIstTime(updated.scheduledAt)}`,
          href: "/appointments",
          meta: { appointmentUnitId: updated.unitId },
        }))
    );
  });

  return jsonOk({ appointment: await enrichAppointment(updated) });
});
