import { timingSafeEqual } from "crypto";
import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { prisma } from "@meiyon/db";
import { runHearingSmsJob } from "@/lib/services/hearing-sms.job";
import {
  findUsersByRoles,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

export const maxDuration = 300;

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonFail("SERVER_ERROR", "CRON_SECRET is not configured", 500);
  }
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!header || !secretsEqual(header, secret)) {
    return jsonFail("UNAUTHORIZED", "Unauthorized", 401);
  }
  return null;
}

async function handleCron() {
  const result = await runHearingSmsJob();

  scheduleNotify(async () => {
    const offices = await prisma.office.findMany({
      where: { status: "active" },
      select: { id: true, unitId: true },
    });
    const title = `Hearing SMS: ${result.sent} sent for ${result.date}`;
    const more = result.hasMore ? " · more pending" : "";
    const body = `Total ${result.total} · failed ${result.failed} · skipped ${result.skipped}${more}`;

    for (const office of offices) {
      const admins = await findUsersByRoles(office.id, ["admin", "sub_admin"]);
      if (admins.length === 0) continue;
      await notifyUsers(
        admins.map((u) => ({
          officeId: office.id,
          officeUnitId: office.unitId,
          userId: u.id,
          userUnitId: u.unitId,
          type: "system",
          title,
          body,
          href: "/diary",
          meta: {
            date: result.date,
            sent: result.sent,
            failed: result.failed,
            skipped: result.skipped,
            total: result.total,
            hasMore: result.hasMore,
            source: "cron",
          },
        }))
      );
    }
  });

  return jsonOk(result);
}

export const GET = apiHandler(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return handleCron();
});

export const POST = apiHandler(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return handleCron();
});
