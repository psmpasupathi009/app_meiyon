import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { PermissionsMatrixPage } from "@/features/permissions/components/permissions-matrix-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("permissions") ||
    !user.permissions.includes("permissions.view")
  ) {
    return <ForbiddenState />;
  }
  return <PermissionsMatrixPage user={user} />;
}
