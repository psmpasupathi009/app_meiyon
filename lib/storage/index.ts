import { compliance } from "@/config/company/compliance";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { detectAllowedMime } from "@/lib/storage/detect-mime";

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

function safeFolder(folder: string): string {
  return (
    folder
      .replace(/[^a-zA-Z0-9_\-./]/g, "_")
      .replace(/\.\./g, "_")
      .slice(0, 80) || "misc"
  );
}

const localDriver: StorageDriver = {
  async put({ buffer, originalName, folder = "misc" }) {
    assertSize(buffer.byteLength);

    const sniffed = detectAllowedMime(buffer);
    if (!sniffed) {
      throw new Error("File type not allowed (only PDF, JPEG, PNG, WebP)");
    }
    assertAllowedMime(sniffed);

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

/** Features call this interface — never `fs` directly. Swap driver in Scale. */
export const storage: StorageDriver = localDriver;
