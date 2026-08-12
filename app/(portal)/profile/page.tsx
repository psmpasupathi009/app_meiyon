import { getSessionUser } from "@/lib/auth/session-user";
import { ForbiddenState } from "@/shared/components/feedback/forbidden-state";
import { ProfilePage } from "@/features/profile/components/profile-page";

export default async function ProfileRoute() {
  const user = await getSessionUser();
  if (!user) return <ForbiddenState />;
  return <ProfilePage user={user} />;
}
