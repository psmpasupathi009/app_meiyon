import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { istDateKey } from "@/lib/utils/ist";
import { ymdSchema } from "@/lib/validations/hrms.schema";
import { buildPresenceBoard } from "@/features/hrms/server/presence";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "hrms", "manage_attendance");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date")?.trim() || istDateKey();
  const parsed = ymdSchema.safeParse(rawDate);
  if (!parsed.success) {
    return jsonFail("VALIDATION", "Use YYYY-MM-DD for date", 400);
  }

  const board = await buildPresenceBoard(parsed.data);
  return jsonOk(board);
});
