import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { runHearingSmsJob } from "@/lib/services/hearing-sms.job";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/rate-limit/client-key";
import {
  findUsersByRoles,
  notifyUsers,
  scheduleNotify,
} from "@/lib/notifications/notify";

/** Staff trigger: send tomorrow's client hearing SMS now (same job as cron). */
export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "cases", "edit");
  if (!user) return response;

  const limited = await rateLimit(
    clientRateKey(request, "hearing-sms", user.unitId),
    3,
    15 * 60 * 1000
  );
  if (!limited.allowed) {
    return jsonFail(
      "RATE_LIMITED",
      "Too many SMS jobs. Try again in a few minutes.",
      429
    );
  }

  const result = await runHearingSmsJob();

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "hearing.sms_manual",
    entity: "Hearing",
    meta: {
      date: result.date,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      hasMore: result.hasMore,
    },
  });

  scheduleNotify(async () => {
    const admins = await findUsersByRoles(user.officeId, ["admin", "sub_admin"]);
    const title = `Hearing SMS: ${result.sent} sent for ${result.date}`;
    const more = result.hasMore ? " · more pending" : "";
    const body = `Total ${result.total} · failed ${result.failed} · skipped ${result.skipped}${more}`;
    await notifyUsers(
      admins.map((u) => ({
        officeId: user.officeId,
        officeUnitId: user.officeUnitId,
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
          source: "manual",
          actorUnitId: user.unitId,
        },
      }))
    );
  });

  return jsonOk(result);
});
