import { PlatformRole } from "@prisma/client";
import { prisma } from "../src/client";

const GB = BigInt(1024 * 1024 * 1024);

async function nextPlatformId(entity: string, prefix: string, pad = 5) {
  const counter = await prisma.platformIdCounter.upsert({
    where: { entity },
    create: { entity, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `${prefix}-${String(counter.seq).padStart(pad, "0")}`;
}

const PLAN_SEEDS = [
  {
    code: "starter",
    name: "Starter",
    monthlyPricePaise: 199900,
    yearlyPricePaise: 1999000,
    seatLimit: 5,
    smsLimit: 200,
    storageBytes: 2n * GB,
    moduleEntitlements: [
      "dashboard",
      "clients",
      "cases",
      "diary",
      "appointments",
      "availability",
      "tasks",
      "employees",
      "permissions",
      "activity",
      "notifications",
      "court_roster",
      "client_portal",
      "mobile_apps",
      "reports_basic",
    ],
  },
  {
    code: "professional",
    name: "Professional",
    monthlyPricePaise: 499900,
    yearlyPricePaise: 4999000,
    seatLimit: 25,
    smsLimit: 1000,
    storageBytes: 20n * GB,
    moduleEntitlements: [
      "dashboard",
      "clients",
      "cases",
      "diary",
      "appointments",
      "availability",
      "tasks",
      "employees",
      "permissions",
      "activity",
      "notifications",
      "court_roster",
      "client_portal",
      "mobile_apps",
      "reports_full",
      "accounts",
      "expenses",
      "dak",
      "documents",
      "csv_imports",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthlyPricePaise: 999900,
    yearlyPricePaise: 9999000,
    seatLimit: 100,
    smsLimit: 5000,
    storageBytes: 100n * GB,
    moduleEntitlements: [
      "dashboard",
      "clients",
      "cases",
      "diary",
      "appointments",
      "availability",
      "tasks",
      "employees",
      "permissions",
      "activity",
      "notifications",
      "court_roster",
      "client_portal",
      "mobile_apps",
      "reports_full",
      "accounts",
      "expenses",
      "dak",
      "documents",
      "csv_imports",
      "hrms",
      "hearing_sms",
      "branding_full",
    ],
  },
] as const;

function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function seedPlans() {
  for (const plan of PLAN_SEEDS) {
    const existing = await prisma.plan.findUnique({ where: { code: plan.code } });
    const catalogFields = {
      name: plan.name,
      monthlyPricePaise: plan.monthlyPricePaise,
      yearlyPricePaise: plan.yearlyPricePaise,
      seatLimit: plan.seatLimit,
      smsLimit: plan.smsLimit,
      storageBytes: plan.storageBytes,
      moduleEntitlements: [...plan.moduleEntitlements] as string[],
      trialDays: 14,
    };

    if (existing) {
      await prisma.plan.update({
        where: { code: plan.code },
        data: catalogFields,
      });
      console.log(`  ~ Plan ${plan.name} updated (${existing.unitId})`);
      continue;
    }

    const unitId = await nextPlatformId("PLN", "PLN");
    await prisma.plan.create({
      data: {
        unitId,
        code: plan.code,
        ...catalogFields,
      },
    });
    console.log(`  + Plan ${plan.name} (${unitId})`);
  }
}

async function seedPlatformOwner() {
  const mobile = normalizeMobile(process.env.ADMIN_MOBILE ?? "");
  if (!mobile) {
    throw new Error("ADMIN_MOBILE is required to seed the super admin");
  }

  const roles = [PlatformRole.psm_super_admin, PlatformRole.platform_owner];
  const existing = await prisma.platformUser.findUnique({ where: { mobile } });
  if (existing) {
    await prisma.platformUser.update({
      where: { id: existing.id },
      data: {
        roles: Array.from(new Set([...existing.roles, ...roles])),
        isActive: true,
      },
    });
    console.log(
      `  ~ Super admin ${existing.unitId}${existing.pinHash ? " (PIN already set)" : " (set PIN after OTP login)"}`,
    );
    return existing;
  }

  const unitId = await nextPlatformId("PADMIN", "PADMIN");
  const owner = await prisma.platformUser.create({
    data: {
      unitId,
      mobile,
      name: "PSM Super Admin",
      roles,
      isActive: true,
    },
  });
  console.log(`  + Super admin ${unitId} (mobile ${mobile}, no PIN — first login uses OTP)`);
  return owner;
}

async function seedMeiyonProduct() {
  const adminUrl = process.env.NEXT_PUBLIC_MEIYON_ADMIN_URL ?? "/meiyon";
  const existing = await prisma.product.findUnique({ where: { slug: "meiyon" } });
  if (existing) {
    await prisma.product.update({
      where: { slug: "meiyon" },
      data: { name: "MEIYON", adminUrl, isActive: true },
    });
    console.log(`  ~ Product MEIYON updated (${adminUrl})`);
    return existing;
  }

  const product = await prisma.product.create({
    data: {
      slug: "meiyon",
      name: "MEIYON",
      adminUrl,
      isActive: true,
    },
  });
  console.log(`  + Product MEIYON (${adminUrl})`);
  return product;
}

async function main() {
  console.log("Seeding MEIYON catalog (plans + super admin + product, no demo data)…");
  await seedPlans();
  await seedPlatformOwner();
  await seedMeiyonProduct();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
