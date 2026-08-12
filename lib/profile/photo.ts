import sharp from "sharp";

const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB before process
const SIZE = 512;

export function isAvatarMime(mime: string): boolean {
  return AVATAR_MIME.has(mime);
}

/**
 * Normalize profile photo with sharp: auto-orient, square cover crop, JPEG.
 */
export async function processProfilePhoto(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isAvatarMime(mimeType)) {
    throw new Error("Use a JPG, PNG or WEBP image");
  }
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new Error("Image too large (max 8 MB)");
  }

  const out = await sharp(buffer)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return { buffer: out, mimeType: "image/jpeg" };
}
