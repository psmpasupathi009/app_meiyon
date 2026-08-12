import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { DiaryPage } from "@/features/diary/components/diary-page";
import { isModuleEnabled } from "@meiyon/config";

function canAccessDiary(permissions: string[] | undefined): boolean {
  const perms = permissions ?? [];
  return (
    (isModuleEnabled("cases") && perms.includes("cases.view")) ||
    (isModuleEnabled("appointments") &&
      perms.includes("appointments.view")) ||
    (isModuleEnabled("tasks") && perms.includes("tasks.view"))
  );
}

export default async function DiaryRoutePage() {
  const user = await getSessionUser();
  if (!user || !canAccessDiary(user.permissions)) {
    return <ForbiddenState />;
  }
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <DiaryPage user={user} />
    </Suspense>
  );
}
