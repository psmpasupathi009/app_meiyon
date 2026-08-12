import type { Appointment } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { toAppointmentSummary } from "@/features/appointments/server/serialize";
import { personDisplayName } from "@/shared/lib/person";
import { userPhotoUrl } from "@/lib/auth/user-photo";

/** Attach client + advocate display fields for list/detail responses. */
export async function enrichAppointments(
  rows: Appointment[],
  opts?: { stripNotes?: boolean }
) {
  if (rows.length === 0) return [];

  const clientUnitIds = [
    ...new Set(rows.map((r) => r.clientUnitId).filter(Boolean) as string[]),
  ];
  const advocateMobiles = [
    ...new Set(
      rows
        .map((r) => r.advocateMobile)
        .filter(Boolean)
        .flatMap((m) => {
          const d = m!.replace(/\D/g, "");
          const ten =
            d.length === 12 && d.startsWith("91") ? d.slice(2) : d.slice(-10);
          return [m!, ten, `91${ten}`];
        }) as string[]
    ),
  ];

  const [clients, advocates] = await Promise.all([
    clientUnitIds.length
      ? prisma.client.findMany({
          where: { unitId: { in: clientUnitIds } },
          select: { unitId: true, name: true },
        })
      : Promise.resolve([]),
    advocateMobiles.length
      ? prisma.user.findMany({
          where: {
            OR: advocateMobiles.map((m) => ({ mobile: m })),
          },
          select: { mobile: true, name: true, unitId: true, photoKey: true },
        })
      : Promise.resolve([]),
  ]);

  const clientByUnit = new Map(clients.map((c) => [c.unitId, c.name]));
  type AdvInfo = { name: string; photoUrl?: string; unitId: string };
  const advocateByMobile = new Map<string, AdvInfo>();
  for (const a of advocates) {
    const d = a.mobile.replace(/\D/g, "");
    const ten =
      d.length === 12 && d.startsWith("91") ? d.slice(2) : d.slice(-10);
    const info: AdvInfo = {
      name: personDisplayName({
        name: a.name,
        mobile: a.mobile,
        unitId: a.unitId,
      }),
      photoUrl: userPhotoUrl(a.unitId, Boolean(a.photoKey)),
      unitId: a.unitId,
    };
    advocateByMobile.set(a.mobile, info);
    advocateByMobile.set(ten, info);
    advocateByMobile.set(`91${ten}`, info);
  }

  return rows.map((r) => {
    const adv = r.advocateMobile
      ? advocateByMobile.get(r.advocateMobile) ??
        advocateByMobile.get(r.advocateMobile.replace(/\D/g, "").slice(-10))
      : undefined;
    const summary = toAppointmentSummary(r, {
      clientName: r.clientUnitId
        ? clientByUnit.get(r.clientUnitId) ?? null
        : null,
      advocateName: adv?.name ?? null,
      advocatePhotoUrl: adv?.photoUrl ?? null,
      advocateUnitId: adv?.unitId ?? null,
    });
    if (opts?.stripNotes) {
      return { ...summary, notes: null };
    }
    return summary;
  });
}

export async function enrichAppointment(
  row: Appointment,
  opts?: { stripNotes?: boolean }
) {
  const [enriched] = await enrichAppointments([row], opts);
  return enriched!;
}
