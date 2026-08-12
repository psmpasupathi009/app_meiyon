import bcrypt from "bcryptjs";
import {
  PlatformRole,
  UserRole,
  type Prisma,
} from "@prisma/client";
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

async function nextOfficeId(
  officeId: string,
  entity: string,
  prefix: string,
  pad = 5
) {
  const counter = await prisma.idCounter.upsert({
    where: { officeId_entity: { officeId, entity } },
    create: { officeId, entity, seq: 1 },
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

const PERMISSION_CATALOG: { module: string; action: string }[] = [
  { module: "dashboard", action: "view" },
  { module: "employees", action: "view" },
  { module: "employees", action: "create" },
  { module: "employees", action: "edit" },
  { module: "employees", action: "deactivate" },
  { module: "permissions", action: "view" },
  { module: "permissions", action: "edit" },
  { module: "activity", action: "view" },
  { module: "clients", action: "view" },
  { module: "clients", action: "create" },
  { module: "clients", action: "edit" },
  { module: "appointments", action: "view" },
  { module: "appointments", action: "create" },
  { module: "appointments", action: "edit" },
  { module: "appointments", action: "cancel" },
  { module: "cases", action: "view" },
  { module: "cases", action: "create" },
  { module: "cases", action: "edit" },
  { module: "cases", action: "upload" },
  { module: "accounts", action: "view" },
  { module: "accounts", action: "create" },
  { module: "accounts", action: "edit" },
  { module: "tasks", action: "view" },
  { module: "tasks", action: "create" },
  { module: "tasks", action: "edit" },
  { module: "reports", action: "view" },
];

const ADMIN_ROLE_PERMS: Record<UserRole, boolean> = {
  admin: true,
  sub_admin: true,
  staff: false,
  advocate: false,
  accountant: false,
  client: false,
};

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
  const mobile = normalizeMobile(process.env.ADMIN_MOBILE ?? "8675762821");
  const existing = await prisma.platformUser.findUnique({ where: { mobile } });
  if (existing) {
    console.log(`  = Platform owner already exists (${existing.unitId})`);
    return existing;
  }

  const unitId = await nextPlatformId("PADMIN", "PADMIN");
  const pinHash = await bcrypt.hash("123456", 12);
  const owner = await prisma.platformUser.create({
    data: {
      unitId,
      mobile,
      name: "Platform Owner",
      roles: [PlatformRole.platform_owner],
      pinHash,
      isActive: true,
    },
  });
  console.log(`  + Platform owner ${unitId} (mobile ${mobile}, PIN 123456)`);
  return owner;
}

async function seedDemoOffice() {
  const adminMobile = normalizeMobile(process.env.ADMIN_MOBILE ?? "8675762821");
  const existing = await prisma.office.findUnique({ where: { slug: "demo-chamber" } });
  if (existing) {
    const admin = await prisma.user.findFirst({
      where: { officeId: existing.id, mobile: adminMobile },
    });
    if (admin) {
      console.log(`  = Demo office already exists (${existing.unitId})`);
      return;
    }
    const pinHash = await bcrypt.hash("123456", 12);
    const empUnitId = await nextOfficeId(existing.id, "EMP", "EMP");
    await prisma.user.create({
      data: {
        unitId: empUnitId,
        officeId: existing.id,
        officeUnitId: existing.unitId,
        mobile: adminMobile,
        name: "Demo Admin",
        roles: [UserRole.admin],
        designation: "Managing Partner",
        pinHash,
        isActive: true,
      },
    });
    console.log(`  + Demo office admin restored (${empUnitId}, PIN 123456)`);
    return;
  }

  const officeUnitId = await nextPlatformId("OFF", "OFF");
  const trialPlan = await prisma.plan.findUnique({ where: { code: "professional" } });
  if (!trialPlan) throw new Error("Plans must be seeded first");

  const office = await prisma.office.create({
    data: {
      unitId: officeUnitId,
      name: "Demo Law Chamber",
      slug: "demo-chamber",
      displayName: "Demo Law Chamber",
      status: "active",
      phone: "9876543210",
      email: "admin@demo-chamber.example",
      state: "Tamil Nadu",
    },
  });

  const subUnitId = await nextPlatformId("SUB", "SUB");
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  await prisma.subscription.create({
    data: {
      unitId: subUnitId,
      officeId: office.id,
      officeUnitId: office.unitId,
      planId: trialPlan.id,
      planUnitId: trialPlan.unitId,
      status: "trialing",
      billingCycle: "monthly",
      trialEndsAt: trialEnd,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
    },
  });

  const entities = [
    "employee",
    "client",
    "case",
    "hearing",
    "appointment",
    "payment",
    "expense",
    "document",
    "officeTask",
    "notification",
  ];
  for (const entity of entities) {
    await prisma.idCounter.create({
      data: { officeId: office.id, entity, seq: 0 },
    });
  }

  for (const { module, action } of PERMISSION_CATALOG) {
    for (const role of Object.keys(ADMIN_ROLE_PERMS) as UserRole[]) {
      const allowed =
        role === "admin" ||
        (role === "sub_admin" &&
          !["permissions.edit", "employees.deactivate"].includes(
            `${module}.${action}`
          )) ||
        (role === "staff" &&
          ["dashboard.view", "cases.view", "clients.view"].includes(
            `${module}.${action}`
          )) ||
        (role === "advocate" &&
          [
            "dashboard.view",
            "cases.view",
            "cases.edit",
            "appointments.view",
          ].includes(`${module}.${action}`)) ||
        (role === "client" &&
          [
            "dashboard.view",
            "cases.view",
            "appointments.view",
            "appointments.create",
          ].includes(`${module}.${action}`));

      await prisma.rolePermission.create({
        data: { officeId: office.id, role, module, action, allowed },
      });
    }
  }

  const pinHash = await bcrypt.hash("123456", 12);
  let empUnitId = await nextOfficeId(office.id, "employee", "EMP");
  // Avoid colliding with leftover unitIds from partial seeds
  for (let i = 0; i < 20; i++) {
    const clash = await prisma.user.findUnique({ where: { unitId: empUnitId } });
    if (!clash) break;
    empUnitId = await nextOfficeId(office.id, "employee", "EMP");
  }

  await prisma.user.create({
    data: {
      unitId: empUnitId,
      officeId: office.id,
      officeUnitId: office.unitId,
      mobile: adminMobile,
      name: "Demo Admin",
      roles: [UserRole.admin],
      designation: "Managing Partner",
      pinHash,
      isActive: true,
    },
  });

  await prisma.platformAuditLog.create({
    data: {
      action: "office.created",
      entityType: "Office",
      entityUnitId: office.unitId,
      meta: { name: office.name, plan: trialPlan.code },
    },
  });

  console.log(
    `  + Demo office ${officeUnitId} with admin ${empUnitId} (PIN 123456)`
  );
}

async function main() {
  console.log("Seeding MEIYON database…");
  await seedPlans();
  await seedPlatformOwner();
  await seedDemoOffice();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
