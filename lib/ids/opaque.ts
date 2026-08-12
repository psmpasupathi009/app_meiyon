/**
 * Opaque public tokens for internal Mongo ObjectIds.
 * Clients never see raw 24-hex ObjectIds; server encodes/decodes for cursors/keys.
 */

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export function encodeOpaqueId(objectId: string): string {
  return Buffer.from(objectId, "utf8").toString("base64url");
}

/** Returns the internal ObjectId, or null if the token is invalid. */
export function decodeOpaqueId(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    if (!OBJECT_ID_RE.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}
