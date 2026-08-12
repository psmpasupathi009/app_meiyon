import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { CaseDetailPage } from "@/features/cases/components/case-detail-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("cases") ||
    !user.permissions.includes("cases.view")
  ) {
    return <ForbiddenState />;
  }
  const { unitId } = await params;
  return <CaseDetailPage user={user} unitId={unitId} />;
}
