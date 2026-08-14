import { v2 as cloudinary } from "cloudinary";

export function cloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function ensureConfig() {
  if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config({ secure: true });
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function cloudinaryRootFolder(): string {
  return (process.env.CLOUDINARY_FOLDER?.trim() || "meiyon").replace(
    /[^a-zA-Z0-9_\-]/g,
    "_"
  );
}

export function parseCloudinaryUrl(url: string): {
  publicId: string;
  resourceType: "image" | "video" | "raw";
} | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    // /{cloud}/image/upload/v123/folder/name.ext
    const typeIdx = parts.findIndex((p) =>
      ["image", "video", "raw"].includes(p)
    );
    if (typeIdx < 0) return null;
    const resourceType = parts[typeIdx] as "image" | "video" | "raw";
    const uploadIdx = parts.indexOf("upload", typeIdx);
    if (uploadIdx < 0) return null;
    let rest = parts.slice(uploadIdx + 1);
    if (rest[0]?.startsWith("v") && /^v\d+$/.test(rest[0])) {
      rest = rest.slice(1);
    }
    if (rest.length === 0) return null;
    let publicId = rest.join("/");
    if (resourceType !== "raw") {
      publicId = publicId.replace(/\.[^.]+$/, "");
    }
    return { publicId: decodeURIComponent(publicId), resourceType };
  } catch {
    return null;
  }
}

export async function cloudinaryUpload(input: {
  buffer: Buffer;
  folder: string;
  originalName: string;
}): Promise<{ url: string; mimeHint?: string }> {
  ensureConfig();
  const folder = `${cloudinaryRootFolder()}/${input.folder}`;
  const result = await new Promise<{
    secure_url?: string;
    resource_type?: string;
    format?: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
        filename_override: input.originalName.replace(/[^\w.\-]+/g, "_").slice(0, 80),
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(uploaded);
      }
    );
    stream.end(input.buffer);
  });

  if (!result.secure_url) {
    throw new Error("Cloudinary did not return a URL");
  }
  return { url: result.secure_url, mimeHint: result.format };
}

export async function cloudinaryFetch(url: string): Promise<Buffer | null> {
  if (!url.startsWith("https://")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function cloudinaryDestroy(url: string): Promise<void> {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return;
  ensureConfig();
  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
    });
  } catch {
    // ignore missing
  }
}
