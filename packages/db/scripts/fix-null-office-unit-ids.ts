/**
 * Backfill or remove Subscription/Invoice docs missing officeUnitId.
 * Prisma cannot read required String fields that are null in Mongo.
 */
import { prisma } from "../src/client";

type RawDoc = {
  _id: { $oid: string };
  officeId?: { $oid: string };
  unitId?: string;
};

async function findNullOfficeUnitId(collection: string): Promise<RawDoc[]> {
  const result = (await prisma.$runCommandRaw({
    find: collection,
    filter: {
      $or: [{ officeUnitId: null }, { officeUnitId: { $exists: false } }],
    },
  })) as { cursor: { firstBatch: RawDoc[] } };
  return result.cursor.firstBatch;
}

async function deleteById(collection: string, id: string) {
  await prisma.$runCommandRaw({
    delete: collection,
    deletes: [{ q: { _id: { $oid: id } }, limit: 1 }],
  });
}

async function setOfficeUnitId(
  collection: string,
  id: string,
  officeUnitId: string
) {
  await prisma.$runCommandRaw({
    update: collection,
    updates: [
      {
        q: { _id: { $oid: id } },
        u: { $set: { officeUnitId } },
      },
    ],
  });
}

async function repair(collection: string) {
  const bad = await findNullOfficeUnitId(collection);
  console.log(`${collection}: ${bad.length} doc(s) missing officeUnitId`);

  for (const doc of bad) {
    const id = doc._id.$oid;
    const officeId = doc.officeId?.$oid;
    console.log(`  ${doc.unitId ?? id} officeId=${officeId ?? "—"}`);

    if (!officeId) {
      await deleteById(collection, id);
      console.log("    deleted (no officeId)");
      continue;
    }

    const office = await prisma.office.findUnique({ where: { id: officeId } });
    if (!office) {
      await deleteById(collection, id);
      console.log("    deleted (office missing)");
      continue;
    }

    await setOfficeUnitId(collection, id, office.unitId);
    console.log(`    backfilled officeUnitId=${office.unitId}`);
  }
}

async function main() {
  await repair("Subscription");
  await repair("Invoice");

  const subs = await prisma.subscription.findMany();
  console.log(`subscription.findMany OK (${subs.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
