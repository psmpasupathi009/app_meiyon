import { prisma } from "../src/client";

const DEMO_SLUG = "demo-chamber";

async function main() {
  const office = await prisma.office.findUnique({ where: { slug: DEMO_SLUG } });
  if (!office) {
    console.log(`No demo office (${DEMO_SLUG}) found.`);
    return;
  }

  const officeId = office.id;
  console.log(`Purging demo office ${office.unitId} (${office.name})…`);

  const counts = await prisma.$transaction([
    prisma.notification.deleteMany({ where: { officeId } }),
    prisma.courtDutyOverride.deleteMany({ where: { officeId } }),
    prisma.officeHoliday.deleteMany({ where: { officeId } }),
    prisma.advocateTimeBlock.deleteMany({ where: { officeId } }),
    prisma.advocateWeeklyHours.deleteMany({ where: { officeId } }),
    prisma.leaveRequest.deleteMany({ where: { officeId } }),
    prisma.attendance.deleteMany({ where: { officeId } }),
    prisma.officeTask.deleteMany({ where: { officeId } }),
    prisma.dakEntry.deleteMany({ where: { officeId } }),
    prisma.appointment.deleteMany({ where: { officeId } }),
    prisma.document.deleteMany({ where: { officeId } }),
    prisma.officeExpense.deleteMany({ where: { officeId } }),
    prisma.cashPayment.deleteMany({ where: { officeId } }),
    prisma.hearing.deleteMany({ where: { officeId } }),
    prisma.case.deleteMany({ where: { officeId } }),
    prisma.client.deleteMany({ where: { officeId } }),
    prisma.auditLog.deleteMany({ where: { officeId } }),
    prisma.rolePermission.deleteMany({ where: { officeId } }),
    prisma.idCounter.deleteMany({ where: { officeId } }),
    prisma.invoice.deleteMany({ where: { officeId } }),
    prisma.usageCounter.deleteMany({ where: { officeId } }),
    prisma.subscription.deleteMany({ where: { officeId } }),
    prisma.user.deleteMany({ where: { officeId } }),
    prisma.platformAuditLog.deleteMany({
      where: { entityType: "Office", entityUnitId: office.unitId },
    }),
    prisma.office.delete({ where: { id: officeId } }),
  ]);

  console.log(`Deleted demo office and related rows (${counts.length} operations).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
