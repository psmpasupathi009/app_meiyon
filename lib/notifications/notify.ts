import type { Prisma, UserRole } from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { officeData, type OfficeScope } from "@/lib/office/scope";
import {
  publishNotification,
  type NotificationPayload,
  type NotificationType,
} from "@/lib/notifications/sse-hub";
import { istAddCalendarDays, istDateKey } from "@/lib/utils/ist";

export type NotifyUserRef = { id: string; unitId: string };

/** Prisma MongoDB: unset optional DateTime ≠ `null` filter. Match both. */
export const unreadNotificationWhere = {
  OR: [{ readAt: null }, { readAt: { isSet: false } }],
};

export type NotifyInput = OfficeScope & {
  userId: string;
  userUnitId: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  href?: string | null;
  meta?: Prisma.InputJsonValue;
};

export function toNotificationPayload(row: {
  unitId: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  meta: Prisma.JsonValue | null;
  createdAt: Date;
  readAt: Date | null;
}): NotificationPayload {
  return {
    unitId: row.unitId,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    meta: row.meta ?? undefined,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

export async function notifyUser(input: NotifyInput) {
  const unitId = await nextUnitId("notification", input);
  const row = await prisma.notification.create({
    data: {
      ...officeData(input),
      unitId,
      userId: input.userId,
      userUnitId: input.userUnitId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      meta: input.meta ?? undefined,
      readAt: null,
    },
  });
  const payload = toNotificationPayload(row);
  publishNotification(input.userId, payload);
  return payload;
}

export async function notifyUsers(inputs: NotifyInput[]) {
  const seen = new Set<string>();
  const results = [];
  for (const input of inputs) {
    if (seen.has(input.userId)) continue;
    seen.add(input.userId);
    results.push(await notifyUser(input));
  }
  return results;
}

/**
 * Schedule notification side-effects after the response is sent (`after`),
 * so work still completes on serverless. Failures never break the main flow.
 */
export function scheduleNotify(fn: () => Promise<unknown>) {
  after(async () => {
    try {
      await fn();
    } catch {
      /* ignore */
    }
  });
}

export function mergeUserRefs(...groups: NotifyUserRef[][]): NotifyUserRef[] {
  const map = new Map<string, NotifyUserRef>();
  for (const group of groups) {
    for (const u of group) map.set(u.id, u);
  }
  return [...map.values()];
}

/** Find active users who have a given permission key allowed for any of their roles. */
export async function findUsersWithPermission(
  officeId: string,
  module: string,
  action: string
): Promise<NotifyUserRef[]> {
  const roles = await prisma.rolePermission.findMany({
    where: { officeId, module, action, allowed: true },
    select: { role: true },
  });
  const roleList = [...new Set(roles.map((r) => r.role))];
  if (roleList.length === 0) return [];

  return prisma.user.findMany({
    where: {
      officeId,
      isActive: true,
      roles: { hasSome: roleList },
    },
    select: { id: true, unitId: true },
  });
}

export async function findUsersByRoles(
  officeId: string,
  roles: UserRole[]
): Promise<NotifyUserRef[]> {
  if (roles.length === 0) return [];
  return prisma.user.findMany({
    where: {
      officeId,
      isActive: true,
      roles: { hasSome: roles },
    },
    select: { id: true, unitId: true },
  });
}

export async function findUsersByMobiles(
  officeId: string,
  mobiles: string[]
): Promise<NotifyUserRef[]> {
  const variants = new Set<string>();
  for (const m of mobiles) {
    const d = m.replace(/\D/g, "");
    if (!d) continue;
    const ten = d.length >= 10 ? d.slice(-10) : d;
    variants.add(ten);
    variants.add(`91${ten}`);
    variants.add(d);
  }
  if (variants.size === 0) return [];
  return prisma.user.findMany({
    where: {
      officeId,
      isActive: true,
      OR: [...variants].map((mobile) => ({ mobile })),
    },
    select: { id: true, unitId: true },
  });
}

/** Advocates on the case (by mobile) plus anyone with cases.edit. */
export async function findCaseNotifyRecipients(
  officeId: string,
  mobiles: (string | null | undefined)[]
): Promise<NotifyUserRef[]> {
  const cleaned = mobiles.filter((m): m is string => Boolean(m?.trim()));
  const [advocates, editors] = await Promise.all([
    findUsersByMobiles(officeId, cleaned),
    findUsersWithPermission(officeId, "cases", "edit"),
  ]);
  return mergeUserRefs(advocates, editors);
}

/** True when hearingDate falls on today..today+days (IST calendar). */
export function isHearingWithinNextIstDays(
  hearingDate: Date,
  days = 2
): boolean {
  const key = istDateKey(hearingDate);
  const today = istDateKey();
  const end = istAddCalendarDays(today, days);
  return key >= today && key <= end;
}
