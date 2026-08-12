import type { Appointment } from "@prisma/client";
import { displayMobile as stripMobile } from "@/lib/auth/mobile";

export type AppointmentSummary = {
  unitId: string;
  clientUnitId: string | null;
  clientName: string | null;
  caseUnitId: string | null;
  advocateMobile: string | null;
  advocateName: string | null;
  advocatePhotoUrl?: string | null;
  advocateUnitId?: string | null;
  title: string;
  scheduledAt: string;
  durationMin: number;
  mode: string;
  location: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

export function toAppointmentSummary(
  item: Appointment,
  extras?: {
    clientName?: string | null;
    advocateName?: string | null;
    advocatePhotoUrl?: string | null;
    advocateUnitId?: string | null;
  }
): AppointmentSummary {
  return {
    unitId: item.unitId,
    clientUnitId: item.clientUnitId,
    clientName: extras?.clientName ?? null,
    caseUnitId: item.caseUnitId,
    advocateMobile: stripMobile(item.advocateMobile ?? "") || null,
    advocateName: extras?.advocateName ?? null,
    advocatePhotoUrl: extras?.advocatePhotoUrl ?? null,
    advocateUnitId: extras?.advocateUnitId ?? null,
    title: item.title,
    scheduledAt: item.scheduledAt.toISOString(),
    durationMin: item.durationMin,
    mode: item.mode ?? "office",
    location: item.location,
    notes: item.notes,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
  };
}
