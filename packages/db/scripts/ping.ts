import { prisma } from "../src/client";

async function main() {
  await prisma.$connect();
  const offices = await prisma.office.count();
  const plans = await prisma.plan.count();
  console.log(`✓ MongoDB connected — ${offices} offices, ${plans} plans`);
}

main()
  .catch((e) => {
    console.error("✗ DB ping failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
