import { prisma } from "@meiyon/db";
import { getSessionUser } from "@/lib/auth/session-user";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

function inr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("admin") && !user.roles.includes("sub_admin")) {
    redirect("/");
  }

  const { unitId } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { unitId, officeId: user.officeId },
  });
  if (!invoice) notFound();

  const office = await prisma.office.findUnique({
    where: { id: user.officeId },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-8 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Tax invoice</p>
          <h1 className="text-2xl font-bold text-zinc-900">{invoice.unitId}</h1>
        </div>
        <Link href="/billing" className="text-sm text-brand underline print:hidden">
          Back to billing
        </Link>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Supplier</dt>
          <dd className="font-medium">PSM Softwares</dd>
          <dd>{invoice.supplierGstin ?? "GSTIN pending (set SUPPLIER_GSTIN)"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Buyer</dt>
          <dd className="font-medium">{office?.displayName ?? office?.name}</dd>
          <dd>GSTIN: {invoice.buyerGstin ?? office?.gstin ?? "—"}</dd>
          <dd>{invoice.placeOfSupply ?? office?.state ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">SAC</dt>
          <dd className="font-medium">{invoice.sac ?? "998314"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status / paid</dt>
          <dd className="font-medium capitalize">{invoice.status}</dd>
          <dd>
            {invoice.paidAt
              ? new Date(invoice.paidAt).toLocaleDateString("en-IN")
              : "—"}
          </dd>
        </div>
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2">Description</th>
            <th className="py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">MEIYON SaaS subscription (taxable)</td>
            <td className="py-2">{inr(invoice.amountPaise)}</td>
          </tr>
          {invoice.cgstPaise > 0 && (
            <tr className="border-b">
              <td className="py-2">CGST 9%</td>
              <td className="py-2">{inr(invoice.cgstPaise)}</td>
            </tr>
          )}
          {invoice.sgstPaise > 0 && (
            <tr className="border-b">
              <td className="py-2">SGST 9%</td>
              <td className="py-2">{inr(invoice.sgstPaise)}</td>
            </tr>
          )}
          {invoice.igstPaise > 0 && (
            <tr className="border-b">
              <td className="py-2">IGST 18%</td>
              <td className="py-2">{inr(invoice.igstPaise)}</td>
            </tr>
          )}
          {invoice.cgstPaise === 0 &&
            invoice.sgstPaise === 0 &&
            invoice.igstPaise === 0 &&
            invoice.taxPaise > 0 && (
              <tr className="border-b">
                <td className="py-2">GST 18%</td>
                <td className="py-2">{inr(invoice.taxPaise)}</td>
              </tr>
            )}
          <tr>
            <td className="py-2 font-semibold">Total</td>
            <td className="py-2 font-semibold">
              {inr(invoice.amountPaise + invoice.taxPaise)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-zinc-500">
        Generated under CGST Rules Rule 46. E-invoice IRP is out of scope until
        turnover requires it.
      </p>
    </div>
  );
}
