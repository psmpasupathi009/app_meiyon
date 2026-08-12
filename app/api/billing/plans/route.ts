import { prisma } from "@meiyon/db";
import { apiHandler, jsonOk } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPricePaise: "asc" },
  });

  return jsonOk(
    plans.map((p) => ({
      code: p.code,
      name: p.name,
      unitId: p.unitId,
      monthlyPricePaise: p.monthlyPricePaise,
      yearlyPricePaise: p.yearlyPricePaise,
      seatLimit: p.seatLimit,
      smsLimit: p.smsLimit,
      storageBytes: p.storageBytes.toString(),
      moduleEntitlements: p.moduleEntitlements,
    }))
  );
});
