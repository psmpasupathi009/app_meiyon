import { compliance } from "@/config/company/compliance";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { detectAllowedMime } from "@/lib/storage/detect-mime";
import {
  cloudinaryConfigured,
  cloudinaryDestroy,
  cloudinaryFetch,
  cloudinaryUpload,
} from "@/lib/storage/cloudinary";

export type StoredFile = {
  key: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export type StorageDriver = {
  put(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    folder?: string;
  }): Promise<StoredFile>;
  get(key: string): Promise<{ buffer: Buffer; mimeType?: string } | null>;
  delete(key: string): Promise<void>;
};

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function assertAllowedMime(mimeType: string): void {
  const allowed = compliance.uploads.allowedMimeTypes as readonly string[];
  if (!allowed.includes(mimeType)) {
    throw new Error(`File type not allowed: ${mimeType}`);
  }
}

function assertSize(size: number): void {
  if (size > compliance.uploads.maxBytes) {
    throw new Error(
      `File too large (max ${Math.round(compliance.uploads.maxBytes / (1024 * 1024))} MB)`
    );
  }
}

export function safeFolder(folder: string): string {
  return (
    folder
      .replace(/[^a-zA-Z0-9_\-./]/g, "_")
      .replace(/\.\./g, "_")
      .slice(0, 80) || "misc"
  );
}

function sniffAndValidate(buffer: Buffer): string {
  assertSize(buffer.byteLength);
  const sniffed = detectAllowedMime(buffer);
  if (!sniffed) {
    throw new Error("File type not allowed (only PDF, JPEG, PNG, WebP)");
  }
  assertAllowedMime(sniffed);
  return sniffed;
}

const localDriver: StorageDriver = {
  async put({ buffer, originalName, folder = "misc" }) {
    const sniffed = sniffAndValidate(buffer);
    const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const key = `${safeFolder(folder)}/${randomUUID()}-${safeName}`;
    const fullPath = path.join(UPLOAD_ROOT, key);
    if (!fullPath.startsWith(UPLOAD_ROOT + path.sep) && fullPath !== UPLOAD_ROOT) {
      throw new Error("Invalid upload path");
    }
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return {
      key,
      mimeType: sniffed,
      size: buffer.byteLength,
      originalName,
    };
  },

  async get(key) {
    try {
      const fullPath = path.join(UPLOAD_ROOT, key);
      if (!fullPath.startsWith(UPLOAD_ROOT + path.sep)) return null;
      const buffer = await readFile(fullPath);
      return { buffer };
    } catch {
      return null;
    }
  },

  async delete(key) {
    try {
      const fullPath = path.join(UPLOAD_ROOT, key);
      if (!fullPath.startsWith(UPLOAD_ROOT + path.sep)) return;
      await unlink(fullPath);
    } catch {
      // ignore missing
    }
  },
};

const cloudinaryDriver: StorageDriver = {
  async put({ buffer, originalName, folder = "misc" }) {
    const sniffed = sniffAndValidate(buffer);
    const { url } = await cloudinaryUpload({
      buffer,
      folder: safeFolder(folder),
      originalName,
    });
    return {
      key: url,
      mimeType: sniffed,
      size: buffer.byteLength,
      originalName,
    };
  },

  async get(key) {
    const buffer = await cloudinaryFetch(key);
    if (!buffer) return null;
    return { buffer, mimeType: detectAllowedMime(buffer) ?? undefined };
  },

  async delete(key) {
    await cloudinaryDestroy(key);
  },
};

/**
 * Cloudinary when CLOUDINARY_* is set (URL stored in MongoDB).
 * Local disk otherwise. HTTPS keys always resolve via Cloudinary fetch.
 */
export const storage: StorageDriver = {
  async put(input) {
    if (cloudinaryConfigured()) return cloudinaryDriver.put(input);
    return localDriver.put(input);
  },
  async get(key) {
    if (key.startsWith("https://")) return cloudinaryDriver.get(key);
    return localDriver.get(key);
  },
  async delete(key) {
    if (key.startsWith("https://")) return cloudinaryDriver.delete(key);
    return localDriver.delete(key);
  },
};
