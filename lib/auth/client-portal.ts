import type { User, UserRole } from "@prisma/client";

/** Employee roles — never assign `client` via employee create/edit. */
export const STAFF_ROLES: UserRole[] = [
  "admin",
  "sub_admin",
  "staff",
  "advocate",
  "accountant",
];

export function isClientOnlyUser(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  if (!roles?.length) return false;
  return roles.every((r) => r === "client");
}

export function isStaffUser(
  roles: UserRole[] | string[] | null | undefined
): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => STAFF_ROLES.includes(r as UserRole));
}

export function clientUnitIdOf(
  user: Pick<User, "clientUnitId" | "roles"> | null | undefined
): string | null {
  if (!user?.clientUnitId) return null;
  if (!isClientOnlyUser(user.roles)) return null;
  return user.clientUnitId;
}

/** Portal path prefixes a client may open (exact or prefix match). */
const CLIENT_PATH_PREFIXES = [
  "/",
  "/cases",
  "/appointments",
  "/documents",
  "/profile",
  "/notifications",
  "/legal",
] as const;

export function isClientAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return CLIENT_PATH_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

/** Document types clients may upload. */
export const CLIENT_UPLOAD_DOC_TYPES = [
  "id_proof",
  "evidence",
  "affidavit",
  "other",
] as const;

export type ClientUploadDocType = (typeof CLIENT_UPLOAD_DOC_TYPES)[number];

export function isClientUploadDocType(value: string): boolean {
  return (CLIENT_UPLOAD_DOC_TYPES as readonly string[]).includes(value);
}
