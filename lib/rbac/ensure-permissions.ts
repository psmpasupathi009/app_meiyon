import { prisma } from "@meiyon/db";
import {
  PERMISSION_CATALOG,
  permissionSeedRows,
} from "@meiyon/config";

const seededOffices = new Set<string>();
const seeding = new Map<string, Promise<boolean>>();

/**
 * Persist catalog defaults when RolePermission is empty for an office,
 * and backfill newly added catalog keys without overwriting admin edits.
 */
export async function ensureDefaultPermissions(
  officeId: string
): Promise<boolean> {
  if (seededOffices.has(officeId)) return false;

  let job = seeding.get(officeId);
  if (!job) {
    job = (async () => {
      const catalogKeys = PERMISSION_CATALOG.map(
        (c) => `${c.module}.${c.action}`
      );
      const expectedRoles = Array.from(
        new Set(permissionSeedRows().map((r) => r.role))
      );

      const [adminRows, roleRows] = await Promise.all([
        prisma.rolePermission.findMany({
          where: { officeId, role: "admin" },
          select: { module: true, action: true },
        }),
        prisma.rolePermission.findMany({
          where: { officeId },
          distinct: ["role"],
          select: { role: true },
        }),
      ]);

      const adminKeys = new Set(
        adminRows.map((r) => `${r.module}.${r.action}`)
      );
      const rolesPresent = new Set(roleRows.map((r) => r.role));
      const missingCatalog = catalogKeys.some((k) => !adminKeys.has(k));
      const missingRole = expectedRoles.some((r) => !rolesPresent.has(r));
      const empty = adminRows.length === 0;

      // Admin provisioner used to seed client.cases.upload as false.
      await prisma.rolePermission.updateMany({
        where: {
          officeId,
          role: "client",
          module: "cases",
          action: "upload",
          allowed: false,
        },
        data: { allowed: true },
      });

      if (!empty && !missingCatalog && !missingRole) {
        seededOffices.add(officeId);
        return false;
      }

      const rows = permissionSeedRows();
      await Promise.all(
        rows.map((row) =>
          prisma.rolePermission.upsert({
            where: {
              officeId_role_module_action: {
                officeId,
                role: row.role,
                module: row.module,
                action: row.action,
              },
            },
            create: { ...row, officeId },
            update: {},
          })
        )
      );
      seededOffices.add(officeId);
      return true;
    })().finally(() => {
      seeding.delete(officeId);
    });
    seeding.set(officeId, job);
  }

  return job;
}
