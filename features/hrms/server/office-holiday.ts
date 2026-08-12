import { prisma } from "@meiyon/db";

export async function findOfficeHolidayForDate(dateKey: string) {
  const delegate = (
    prisma as unknown as {
      officeHoliday?: {
        findMany: typeof prisma.officeHoliday.findMany;
      };
    }
  ).officeHoliday;
  if (!delegate?.findMany) return null;

  const rows = await delegate.findMany({
    where: {
      fromDate: { lte: dateKey },
      toDate: { gte: dateKey },
    },
    orderBy: { fromDate: "asc" },
    take: 1,
  });
  return rows[0] ?? null;
}

export async function isOfficeHoliday(dateKey: string): Promise<boolean> {
  const hit = await findOfficeHolidayForDate(dateKey);
  return Boolean(hit);
}
