import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { TasksPage } from "@/features/tasks/components/tasks-page";
import { isModuleEnabled } from "@meiyon/config";

export default async function Page() {
  const user = await getSessionUser();
  if (
    !user ||
    !isModuleEnabled("tasks") ||
    !user.permissions.includes("tasks.view")
  ) {
    return <ForbiddenState />;
  }
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <TasksPage user={user} />
    </Suspense>
  );
}
