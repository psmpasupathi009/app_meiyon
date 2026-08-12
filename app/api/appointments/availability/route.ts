import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import {
  getDayAvailability,
  type DayAvailability,
} from "@/lib/appointments/availability";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { requireClientUnitId } from "@/lib/auth/client-scope";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "appointments", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim() ?? "";
  const durationMin = Number(searchParams.get("durationMin") ?? "30") || 30;
  let clientUnitId = searchParams.get("clientUnitId")?.trim() || undefined;
  const excludeAppointmentUnitId =
    searchParams.get("excludeAppointmentUnitId")?.trim() || undefined;

  if (isClientOnlyUser(user.roles)) {
    const cid = requireClientUnitId(user);
    if (!cid) {
      return jsonFail("FORBIDDEN", "Client portal link is missing.", 403);
    }
    clientUnitId = cid;
  }

  let advocateMobile = searchParams.get("advocateMobile")?.trim() || "";
  if (!canBookForAnyAdvocate(user.roles)) {
    advocateMobile = displayMobile(user.mobile);
  }
  if (!advocateMobile) {
    return jsonFail("VALIDATION", "Select an advocate", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonFail("VALIDATION", "date must be YYYY-MM-DD", 400);
  }

  const mobile = normalizeMobile(advocateMobile) ?? advocateMobile;
  const result = await getDayAvailability({
    advocateMobile: mobile,
    dateKey: date,
    durationMin,
    clientUnitId,
    excludeAppointmentUnitId,
  });

  if ("ok" in result && result.ok === false) {
    return jsonFail(result.code, result.message, 400);
  }

  return jsonOk(result as DayAvailability);
});
