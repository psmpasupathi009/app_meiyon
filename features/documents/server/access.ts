import type { Document, User } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";
import { prisma } from "@meiyon/db";

/**
 * View/download: clients only own docs; staff use module perms.
 * Expense bills need expenses.*; fee receipts need accounts.*; other docs need cases.view.
 */
export async function canViewDocument(
  user: User,
  doc: Pick<
    Document,
    "docType" | "expenseUnitId" | "clientUnitId" | "caseUnitId"
  >
): Promise<boolean> {
  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid) return false;
    if (doc.expenseUnitId) return false;
    if (doc.docType === "receipt") return false;
    if (doc.clientUnitId === cid) return true;
    if (doc.caseUnitId) {
      const cse = await prisma.case.findUnique({
        where: { unitId: doc.caseUnitId },
        select: { clientUnitId: true },
      });
      return cse?.clientUnitId === cid;
    }
    return false;
  }

  if (doc.expenseUnitId) {
    if (!isModuleEnabled("expenses")) return false;
    return (
      (await hasPermission(user, "expenses", "view")) ||
      (await hasPermission(user, "expenses", "edit")) ||
      (await hasPermission(user, "expenses", "upload"))
    );
  }
  if (doc.docType === "receipt") {
    if (!isModuleEnabled("accounts")) return false;
    return (
      (await hasPermission(user, "accounts", "view")) ||
      (await hasPermission(user, "accounts", "edit")) ||
      (await hasPermission(user, "accounts", "upload"))
    );
  }
  if (!isModuleEnabled("cases")) return false;
  return hasPermission(user, "cases", "view");
}

/** Delete/upload-style mutate — clients may not delete; staff use upload perms. */
export async function canMutateDocument(
  user: User,
  doc: Pick<Document, "docType" | "expenseUnitId">
): Promise<boolean> {
  if (isClientOnlyUser(user.roles)) return false;

  if (
    isModuleEnabled("cases") &&
    (await hasPermission(user, "cases", "upload"))
  ) {
    return true;
  }
  if (doc.expenseUnitId) {
    if (!isModuleEnabled("expenses")) return false;
    return (
      (await hasPermission(user, "expenses", "edit")) ||
      (await hasPermission(user, "expenses", "upload"))
    );
  }
  if (doc.docType !== "receipt" || !isModuleEnabled("accounts")) return false;
  return (
    (await hasPermission(user, "accounts", "edit")) ||
    (await hasPermission(user, "accounts", "upload"))
  );
}

/** Safe Content-Disposition for downloads (ASCII fallback + RFC 5987). */
export function contentDispositionAttachment(originalName: string): string {
  const ascii = originalName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(originalName).replace(
    /['()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii || "download"}"; filename*=UTF-8''${encoded}`;
}
