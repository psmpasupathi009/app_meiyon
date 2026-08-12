import type { User, UserRole } from "@prisma/client";
import { prisma } from "@meiyon/db";

/** Count active users holding the admin role, optionally excluding one user. */
export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      isActive: true,
      roles: { has: "admin" },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/** Only an admin may grant the admin role to anyone (including themself). */
export function requireAdminToAssignAdmin(
  actor: Pick<User, "roles">,
  targetRoles: UserRole[]
): string | null {
  if (targetRoles.includes("admin") && !actor.roles.includes("admin")) {
    return "Only an admin can assign the admin role";
  }
  return null;
}

/**
 * Only an admin may manage (edit / demote / deactivate / force-reset) a user
 * who currently holds the admin role.
 */
export function requireAdminToManageAdmin(
  actor: Pick<User, "roles">,
  target: Pick<User, "roles">
): string | null {
  if (target.roles.includes("admin") && !actor.roles.includes("admin")) {
    return "Only an admin can manage another admin";
  }
  return null;
}

/** Would this change leave the office with zero active admins? */
export async function wouldRemoveLastAdmin(
  target: Pick<User, "id" | "roles" | "isActive">,
  nextIsActive: boolean,
  nextRoles: UserRole[]
): Promise<boolean> {
  const wasAdmin = target.isActive && target.roles.includes("admin");
  const willBeAdmin = nextIsActive && nextRoles.includes("admin");
  if (!wasAdmin || willBeAdmin) return false;

  const remaining = await countActiveAdmins(target.id);
  return remaining === 0;
}
