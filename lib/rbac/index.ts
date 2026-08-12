import { cache } from "react";
import type { User, UserRole } from "@prisma/client";
import { isModuleEnabled, type AppModule } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { jsonFail } from "@/lib/api/response";
import { ensureDefaultPermissions } from "@/lib/rbac/ensure-permissions";

export type Permission = { module: string; action: string };
export { ensureDefaultPermissions } from "@/lib/rbac/ensure-permissions";

function permKey(module: string, action: string): string {
  return `${module}.${action}`;
}

/**
 * Effective permissions = union of RolePermission rows for user.roles
 * scoped to the user's office. Always from DB — never trust JWT or client body.
 */
export const getEffectivePermissions = cache(
  async (userId: string, officeId: string): Promise<Set<string>> => {
    const user = await prisma.user.findFirst({
      where: { id: userId, officeId },
      select: { roles: true, isActive: true },
    });

    if (!user || !user.isActive || user.roles.length === 0) {
      return new Set();
    }

    await ensureDefaultPermissions(officeId);

    const rows = await prisma.rolePermission.findMany({
      where: {
        officeId,
        role: { in: user.roles },
        allowed: true,
      },
      select: { module: true, action: true },
    });

    return new Set(rows.map((r) => permKey(r.module, r.action)));
  }
);

export async function getEffectivePermissionsForUser(user: {
  id: string;
  officeId: string;
  roles: UserRole[];
  isActive: boolean;
}): Promise<string[]> {
  if (!user.isActive || user.roles.length === 0) return [];
  const set = await getEffectivePermissions(user.id, user.officeId);
  return Array.from(set).sort();
}

export async function getEffectivePermissionsForRoles(
  roles: UserRole[],
  officeId: string
): Promise<string[]> {
  if (roles.length === 0) return [];
  await ensureDefaultPermissions(officeId);
  const rows = await prisma.rolePermission.findMany({
    where: { officeId, role: { in: roles }, allowed: true },
    select: { module: true, action: true },
  });
  return Array.from(new Set(rows.map((r) => permKey(r.module, r.action)))).sort();
}

export async function hasPermission(
  user: Pick<User, "id" | "officeId">,
  module: string,
  action: string
): Promise<boolean> {
  const perms = await getEffectivePermissions(user.id, user.officeId);
  return perms.has(permKey(module, action));
}

export async function requirePermission(
  user: Pick<User, "id" | "officeId">,
  module: string,
  action: string
) {
  const ok = await hasPermission(user, module, action);
  if (!ok) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }
  return null;
}

export function requireModuleEnabled(module: AppModule) {
  if (!isModuleEnabled(module)) {
    return jsonFail("FORBIDDEN", "This module is not available", 403);
  }
  return null;
}

export function rolesInclude(roles: UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}
