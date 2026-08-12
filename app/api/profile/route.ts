import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { toPublicUser } from "@/lib/auth/session";
import { updateProfileSchema } from "@/lib/validations/profile.schema";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  return jsonOk({ user: await toPublicUser(user) });
});

export const PATCH = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const raw = await request.json();
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: input.name,
      email: input.email === "" ? null : input.email || undefined,
      address: input.address === "" ? null : input.address || undefined,
    },
  });

  return jsonOk({ user: await toPublicUser(updated) });
});
