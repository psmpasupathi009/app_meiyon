import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { storage } from "@/lib/storage";
import { processProfilePhoto, isAvatarMime } from "@/lib/profile/photo";
import { toPublicUser } from "@/lib/auth/session";

export const POST = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonFail("VALIDATION", "Choose a photo to upload", 400);
  }

  const mime = file.type || "application/octet-stream";
  if (!isAvatarMime(mime)) {
    return jsonFail("VALIDATION", "Use a JPG, PNG or WEBP image", 400);
  }

  const raw = Buffer.from(await file.arrayBuffer());
  let processed: { buffer: Buffer; mimeType: string };
  try {
    processed = await processProfilePhoto(raw, mime);
  } catch (e) {
    return jsonFail(
      "VALIDATION",
      e instanceof Error ? e.message : "Could not process photo",
      400
    );
  }

  const stored = await storage.put({
    buffer: processed.buffer,
    mimeType: processed.mimeType,
    originalName: "avatar.jpg",
    folder: "avatars",
  });

  const oldKey = user.photoKey;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { photoKey: stored.key },
  });

  if (oldKey) {
    await storage.delete(oldKey).catch(() => undefined);
  }

  return jsonOk({ user: await toPublicUser(updated) });
});

export const DELETE = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  if (!user.photoKey) {
    return jsonOk({ user: await toPublicUser(user) });
  }

  const oldKey = user.photoKey;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { photoKey: null },
  });
  await storage.delete(oldKey).catch(() => undefined);

  return jsonOk({ user: await toPublicUser(updated) });
});
