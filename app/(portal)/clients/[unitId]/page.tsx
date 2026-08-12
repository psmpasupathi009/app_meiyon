import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ClientDetailPage } from "@/features/clients/components/client-detail-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("clients") ||
    !user.permissions.includes("clients.view")
  ) {
    return <ForbiddenState />;
  }
  const { unitId } = await params;
  return <ClientDetailPage user={user} unitId={unitId} />;
}
