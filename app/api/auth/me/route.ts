import { jsonOk } from "@/lib/api/response";
import { getSessionUserRecord, toPublicUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getSessionUserRecord();
  if (!user) return jsonOk({ user: null });
  return jsonOk({ user: await toPublicUser(user as Parameters<typeof toPublicUser>[0]) });
}
