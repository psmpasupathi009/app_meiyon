/**
 * Repair mixed-schema / partial-seed documents so Prisma can read them.
 * Run: npx dotenv -e .env -- tsx scripts/repair-local-db.ts
 */
import { prisma } from "@meiyon/db";

async function main() {
  const now = new Date();

  // Leads written by monorepo marketing schema lacked updatedAt
  const leadFix = await prisma.$runCommandRaw({
    update: "Lead",
    updates: [
      {
        q: { $or: [{ updatedAt: null }, { updatedAt: { $exists: false } }] },
        u: [{ $set: { updatedAt: { $ifNull: ["$createdAt", now] } } }],
        multi: true,
      },
    ],
  });
  console.log("Lead updatedAt backfill:", leadFix);

  // Subscriptions missing planUnitId — fill from Plan via planId
  const plans = await prisma.plan.findMany({ select: { id: true, unitId: true } });
  const planUnitById = new Map(plans.map((p) => [p.id, p.unitId]));

  const rawSubs = (await prisma.$runCommandRaw({
    find: "Subscription",
    filter: { $or: [{ planUnitId: null }, { planUnitId: { $exists: false } }] },
  })) as { cursor?: { firstBatch?: Array<{ _id: { $oid: string }; planId?: { $oid: string } }> } };

  const broken = rawSubs.cursor?.firstBatch ?? [];
  for (const s of broken) {
    const planId = s.planId?.$oid;
    const planUnitId = planId ? planUnitById.get(planId) : undefined;
    if (!planUnitId) {
      console.warn("Skipping sub without resolvable plan", s._id);
      continue;
    }
    await prisma.$runCommandRaw({
      update: "Subscription",
      updates: [
        {
          q: { _id: s._id },
          u: { $set: { planUnitId } },
        },
      ],
    });
    console.log("Fixed subscription", s._id.$oid, "→", planUnitId);
  }

  // Sync IdCounters to max existing unitIds per office/entity to avoid collisions
  const offices = await prisma.office.findMany({ select: { id: true } });
  const entityPrefixes: Record<string, string> = {
    client: "CLI",
    case: "CSE",
    employee: "EMP",
    hearing: "HRG",
    appointment: "APT",
    payment: "PAY",
    expense: "EXP",
    document: "DOC",
    task: "TSK",
    notification: "NTF",
  };

  // Legacy monorepo case statuses → portal CaseStatus enum
  const statusMap: Record<string, string> = {
    open: "enquiry",
    pending: "enquiry",
    listed: "active",
    closed: "disposed",
  };
  for (const [from, to] of Object.entries(statusMap)) {
    const res = await prisma.$runCommandRaw({
      update: "Case",
      updates: [{ q: { status: from }, u: { $set: { status: to } }, multi: true }],
    });
    console.log(`Case status ${from} → ${to}:`, res);
  }

  for (const office of offices) {
    for (const [entity, prefix] of Object.entries(entityPrefixes)) {
      let maxSeq = 0;
      if (entity === "client") {
        const rows = await prisma.client.findMany({
          where: { officeId: office.id },
          select: { unitId: true },
        });
        for (const r of rows) {
          const m = r.unitId.match(new RegExp(`^${prefix}-(\\d+)$`));
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
        }
      } else if (entity === "employee") {
        const rows = await prisma.user.findMany({
          where: { officeId: office.id },
          select: { unitId: true },
        });
        for (const r of rows) {
          const m = r.unitId.match(new RegExp(`^${prefix}-(\\d+)$`));
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
        }
      } else if (entity === "case") {
        const rows = await prisma.case.findMany({
          where: { officeId: office.id },
          select: { unitId: true },
        });
        for (const r of rows) {
          const m = r.unitId.match(new RegExp(`^${prefix}-(\\d+)$`));
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
        }
      }

      if (maxSeq > 0) {
        await prisma.idCounter.upsert({
          where: { officeId_entity: { officeId: office.id, entity } },
          create: { officeId: office.id, entity, seq: maxSeq },
          update: { seq: maxSeq },
        });
        console.log(`Counter ${office.id.slice(-6)}/${entity} → ${maxSeq}`);
      }
    }
  }

  console.log("Repair done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
