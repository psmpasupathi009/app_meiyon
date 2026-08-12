import { NextResponse } from "next/server";
import { apiHandler, jsonFail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { storage } from "@/lib/storage";

/** Serve profile photo — auth required. */
export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { unitId } = (await context.params) ?? {};
  if (!unitId) return jsonFail("NOT_FOUND", "User not found", 404);

  const target = await prisma.user.findFirst({ where: { unitId, officeId: user.officeId },
    select: { photoKey: true, isActive: true },
  });
  if (!target?.isActive) return jsonFail("NOT_FOUND", "User not found", 404);
  if (!target.photoKey) return jsonFail("NOT_FOUND", "No photo", 404);

  const file = await storage.get(target.photoKey);
  if (!file) return jsonFail("NOT_FOUND", "Photo missing", 404);

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
