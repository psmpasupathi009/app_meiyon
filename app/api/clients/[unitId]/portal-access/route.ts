import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";
import { normalizeMobile } from "@/lib/auth/mobile";
import { isStaffUser } from "@/lib/auth/client-portal";
import { ensureDefaultPermissions } from "@/lib/rbac";

type PortalStatus = {
  invited: boolean;
  isActive: boolean;
  userUnitId: string | null;
  hasPin: boolean;
  lastLoginAt: string | null;
};

async function portalStatusForClient(
  clientUnitId: string,
  officeId: string
): Promise<PortalStatus> {
  const portalUser = await prisma.user.findFirst({
    where: { clientUnitId, officeId, roles: { has: "client" } },
    select: {
      unitId: true,
      isActive: true,
      pinHash: true,
      lastLoginAt: true,
      roles: true,
    },
  });
  if (!portalUser || !portalUser.roles.every((r) => r === "client")) {
    return {
      invited: false,
      isActive: false,
      userUnitId: null,
      hasPin: false,
      lastLoginAt: null,
    };
  }
  return {
    invited: true,
    isActive: portalUser.isActive,
    userUnitId: portalUser.unitId,
    hasPin: Boolean(portalUser.pinHash),
    lastLoginAt: portalUser.lastLoginAt?.toISOString() ?? null,
  };
}

/** Invite (or re-activate) client portal login for this Client. */
export const POST = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "clients", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  if (!unitId) return jsonFail("VALIDATION", "Missing client id", 400);

  const client = await prisma.client.findFirst({ where: { unitId, officeId: user.officeId } });
  if (!client) return jsonFail("NOT_FOUND", "Client not found", 404);

  const mobile = normalizeMobile(client.mobile);
  if (!mobile) {
    return jsonFail(
      "VALIDATION",
      "Client mobile is invalid — update the client record first",
      400
    );
  }

  await ensureDefaultPermissions(user.officeId);

  const existingByClient = await prisma.user.findFirst({
    where: { clientUnitId: client.unitId, officeId: user.officeId },
  });
  if (existingByClient) {
    if (!existingByClient.isActive) {
      const reactivated = await prisma.user.update({
        where: { id: existingByClient.id },
        data: {
          isActive: true,
          name: client.name,
          mobile,
          roles: ["client"],
          email: client.email || undefined,
          address: client.address || undefined,
        },
      });
      await writeAudit({
        officeId: user.officeId,
        actorUnitId: user.unitId,
        action: "client.portal.reactivate",
        entity: "Client",
        entityUnitId: client.unitId,
        meta: { userUnitId: reactivated.unitId },
      });
      return jsonOk({
        portal: await portalStatusForClient(client.unitId, user.officeId),
        message:
          "Portal access restored. Client can log in with their mobile and PIN (or set PIN via OTP).",
      });
    }
    return jsonOk({
      portal: await portalStatusForClient(client.unitId, user.officeId),
      message: "Client already has portal access.",
    });
  }

  const existingByMobile = await prisma.user.findFirst({
    where: { mobile, officeId: user.officeId },
  });
  if (existingByMobile) {
    if (isStaffUser(existingByMobile.roles)) {
      return jsonFail(
        "CONFLICT",
        "This mobile is already a staff login. Use a different mobile on the client record.",
        409
      );
    }
    if (
      existingByMobile.clientUnitId &&
      existingByMobile.clientUnitId !== client.unitId
    ) {
      return jsonFail(
        "CONFLICT",
        "This mobile is already linked to another client portal account.",
        409
      );
    }
    // Orphan client-role user without link — attach
    await prisma.user.update({
      where: { id: existingByMobile.id },
      data: {
        clientUnitId: client.unitId,
        roles: ["client"],
        isActive: true,
        name: client.name,
        email: client.email || undefined,
        address: client.address || undefined,
      },
    });
    await writeAudit({
      officeId: user.officeId,
      actorUnitId: user.unitId,
      action: "client.portal.link",
      entity: "Client",
      entityUnitId: client.unitId,
      meta: { userUnitId: existingByMobile.unitId },
    });
    return jsonOk({
      portal: await portalStatusForClient(client.unitId, user.officeId),
      message: "Portal access linked. Client can log in with mobile + PIN/OTP.",
    });
  }

  const userUnitId = await nextUnitId("employee", user);
  const created = await prisma.user.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId: userUnitId,
      mobile,
      roles: ["client"],
      name: client.name,
      email: client.email || undefined,
      address: client.address || undefined,
      clientUnitId: client.unitId,
      isActive: true,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "client.portal.invite",
    entity: "Client",
    entityUnitId: client.unitId,
    meta: { userUnitId: created.unitId },
  });

  return jsonOk(
    {
      portal: await portalStatusForClient(client.unitId, user.officeId),
      message:
        "Portal invited. Client signs in with this mobile, verifies OTP, and sets a PIN.",
    },
    201
  );
});

/** Revoke client portal access (deactivate linked user). */
export const DELETE = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "clients", "edit");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  if (!unitId) return jsonFail("VALIDATION", "Missing client id", 400);

  const client = await prisma.client.findFirst({ where: { unitId, officeId: user.officeId } });
  if (!client) return jsonFail("NOT_FOUND", "Client not found", 404);

  const portalUser = await prisma.user.findFirst({
    where: { clientUnitId: client.unitId, officeId: user.officeId },
  });
  if (!portalUser) {
    return jsonFail("NOT_FOUND", "No portal access for this client", 404);
  }

  await prisma.user.update({
    where: { id: portalUser.id },
    data: { isActive: false },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "client.portal.revoke",
    entity: "Client",
    entityUnitId: client.unitId,
    meta: { userUnitId: portalUser.unitId },
  });

  return jsonOk({
    portal: await portalStatusForClient(client.unitId, user.officeId),
    message: "Portal access revoked.",
  });
});

/** Current portal status for staff UI. */
export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requirePerm(request, "clients", "view");
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  if (!unitId) return jsonFail("VALIDATION", "Missing client id", 400);

  const client = await prisma.client.findFirst({ where: { unitId, officeId: user.officeId },
    select: { unitId: true },
  });
  if (!client) return jsonFail("NOT_FOUND", "Client not found", 404);

  return jsonOk({ portal: await portalStatusForClient(client.unitId, user.officeId) });
});
