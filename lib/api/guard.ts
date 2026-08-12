import type { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { clientUnitIdOf, isClientOnlyUser } from "@/lib/auth/client-portal";
import { hasPermission, requireModuleEnabled } from "@/lib/rbac";
import { jsonFail } from "@/lib/api/response";
import { modules, type AppModule } from "@meiyon/config";

export type GuardResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

const APP_MODULES = new Set<string>(Object.keys(modules.enabled));

function asAppModule(module: string): AppModule | null {
  return APP_MODULES.has(module) ? (module as AppModule) : null;
}

/** Authenticated only — no permission check. */
export async function requireUser(request: Request): Promise<GuardResult> {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, response: jsonFail("UNAUTHORIZED", "Unauthorized", 401) };
  }
  return { user, response: null };
}

/** Authenticated + must hold `module.action` permission (office-scoped). */
export async function requirePerm(
  request: Request,
  module: string,
  action: string
): Promise<GuardResult> {
  const appModule = asAppModule(module);
  if (appModule) {
    const modFail = requireModuleEnabled(appModule);
    if (modFail) return { user: null, response: modFail };
  }

  const { user, response } = await requireUser(request);
  if (!user) return { user: null, response };

  const allowed = await hasPermission(user, module, action);
  if (!allowed) {
    return {
      user: null,
      response: jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403),
    };
  }
  return { user, response: null };
}

/** Authenticated + must hold at least one of the given role names. */
export async function requireRole(
  request: Request,
  roles: string[]
): Promise<GuardResult> {
  const { user, response } = await requireUser(request);
  if (!user) return { user: null, response };

  const ok = user.roles.some((r) => roles.includes(r));
  if (!ok) {
    return {
      user: null,
      response: jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403),
    };
  }
  return { user, response: null };
}

export async function requireClientScope(
  request: Request
): Promise<
  | { user: User; clientUnitId: string; response: null }
  | { user: null; clientUnitId: null; response: NextResponse }
> {
  const { user, response } = await requireUser(request);
  if (!user) {
    return { user: null, clientUnitId: null, response };
  }
  if (!isClientOnlyUser(user.roles)) {
    return {
      user: null,
      clientUnitId: null,
      response: jsonFail("FORBIDDEN", "Client portal access only.", 403),
    };
  }
  const clientUnitId = clientUnitIdOf(user);
  if (!clientUnitId) {
    return {
      user: null,
      clientUnitId: null,
      response: jsonFail(
        "FORBIDDEN",
        "Client portal link is missing. Ask the office to re-invite you.",
        403
      ),
    };
  }
  return { user, clientUnitId, response: null };
}

/** Staff-only: reject pure client sessions. */
export async function requireStaffUser(
  request: Request
): Promise<GuardResult> {
  const { user, response } = await requireUser(request);
  if (!user) return { user: null, response };
  if (isClientOnlyUser(user.roles)) {
    return {
      user: null,
      response: jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403),
    };
  }
  return { user, response: null };
}
