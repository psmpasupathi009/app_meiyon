import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { hasPermission, requireModuleEnabled } from "@/lib/rbac";
import { getEffectivePermissionsForRoles } from "@/lib/rbac";
import { permissionsPreviewSchema } from "@/lib/validations/employees.schema";

/**
 * Preview the union of effective permissions for a set of roles
 * (employee create/edit dialogs). Allowed for anyone who can view or edit employees.
 */
export const POST = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const modFail = requireModuleEnabled("employees");
  if (modFail) return modFail;

  const canView = await hasPermission(user, "employees", "view");
  const canCreate = await hasPermission(user, "employees", "create");
  const canEdit = await hasPermission(user, "employees", "edit");
  if (!canView && !canCreate && !canEdit) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const raw = await request.json();
  const parsed = permissionsPreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }

  const permissions = await getEffectivePermissionsForRoles(
    parsed.data.roles,
    user.officeId
  );

  return jsonOk({ roles: parsed.data.roles, permissions });
});
