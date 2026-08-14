import { prisma } from "@meiyon/db";
import { apiHandler, jsonOk } from "@/lib/api/response";
import { requireRole } from "@/lib/api/guard";

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireRole(request, ["admin", "sub_admin"]);
  if (!user) return response!;

  const invoices = await prisma.invoice.findMany({
    where: { officeId: user.officeId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk(
    invoices.map((inv) => ({
      unitId: inv.unitId,
      amountPaise: inv.amountPaise,
      taxPaise: inv.taxPaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      igstPaise: inv.igstPaise,
      sac: inv.sac,
      supplierGstin: inv.supplierGstin,
      buyerGstin: inv.buyerGstin,
      placeOfSupply: inv.placeOfSupply,
      status: inv.status,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      razorpayPaymentId: inv.razorpayPaymentId,
    }))
  );
});
