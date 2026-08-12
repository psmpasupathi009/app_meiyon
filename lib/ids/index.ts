import { formatUnitId, idConfig, type IdEntity } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import type { OfficeScope } from "@/lib/office/scope";

export type { OfficeScope };

async function unitIdTaken(entity: IdEntity, unitId: string): Promise<boolean> {
  switch (entity) {
    case "employee":
      return !!(await prisma.user.findUnique({ where: { unitId } }));
    case "client":
      return !!(await prisma.client.findUnique({ where: { unitId } }));
    case "case":
      return !!(await prisma.case.findUnique({ where: { unitId } }));
    case "hearing":
      return !!(await prisma.hearing.findUnique({ where: { unitId } }));
    case "appointment":
      return !!(await prisma.appointment.findUnique({ where: { unitId } }));
    case "payment":
      return !!(await prisma.payment.findUnique({ where: { unitId } }));
    case "expense":
      return !!(await prisma.expense.findUnique({ where: { unitId } }));
    case "document":
      return !!(await prisma.document.findUnique({ where: { unitId } }));
    case "officeTask":
      return !!(await prisma.officeTask.findUnique({ where: { unitId } }));
    case "notification":
      return !!(await prisma.notification.findUnique({ where: { unitId } }));
    case "leave":
      return !!(await prisma.leaveRequest.findUnique({ where: { unitId } }));
    case "attendance":
      return !!(await prisma.attendance.findUnique({ where: { unitId } }));
    case "weeklyHours":
      return !!(await prisma.advocateWeeklyHours.findUnique({ where: { unitId } }));
    case "timeBlock":
      return !!(await prisma.advocateTimeBlock.findUnique({ where: { unitId } }));
    case "dak":
      return !!(await prisma.dakEntry.findUnique({ where: { unitId } }));
    case "holiday":
      return !!(await prisma.officeHoliday.findUnique({ where: { unitId } }));
    case "courtDuty":
      return !!(await prisma.courtDutyOverride.findUnique({ where: { unitId } }));
    default:
      return false;
  }
}

/**
 * Atomic sequential unitId per office via IdCounter.$inc.
 * Retries when the generated id collides globally (unitId is unique across offices).
 */
export async function nextUnitId(
  entity: IdEntity,
  office: OfficeScope
): Promise<string> {
  const prefix = idConfig.prefixes[entity];
  const where = { officeId_entity: { officeId: office.officeId, entity } };

  for (let attempt = 0; attempt < 50; attempt++) {
    const counter = await prisma.idCounter.findUnique({ where });

    let seq: number;
    if (!counter) {
      try {
        await prisma.idCounter.create({
          data: { officeId: office.officeId, entity, seq: 1 },
        });
        seq = 1;
      } catch {
        const updated = await prisma.idCounter.update({
          where,
          data: { seq: { increment: 1 } },
        });
        seq = updated.seq;
      }
    } else {
      const updated = await prisma.idCounter.update({
        where,
        data: { seq: { increment: 1 } },
      });
      seq = updated.seq;
    }

    const unitId = formatUnitId(prefix, seq);
    if (!(await unitIdTaken(entity, unitId))) return unitId;
  }

  throw new Error(`Could not allocate unique unitId for ${entity}`);
}
