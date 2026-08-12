import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { ClientDocumentsPage } from "@/features/documents/components/client-documents-page";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const user = await getSessionUser();
  if (!user) return <ForbiddenState />;

  if (!isClientOnlyUser(user.roles)) {
    redirect("/");
  }

  if (!user.permissions.includes("cases.upload")) {
    return <ForbiddenState />;
  }

  return <ClientDocumentsPage user={user} />;
}
