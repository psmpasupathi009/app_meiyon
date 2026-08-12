"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Check, CreditCard, Loader2 } from "lucide-react";

import { Button, PageHeader, StatusBadge } from "@meiyon/ui";

type PlanRow = {
  code: string;
  name: string;
  monthlyPricePaise: number;
  yearlyPricePaise: number;
  seatLimit: number;
  smsLimit: number;
  storageBytes: string;
};

type SubData = {
  subscription: {
    unitId: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  plan: {
    code: string;
    name: string;
    monthlyPricePaise: number;
    yearlyPricePaise: number;
    seatLimit: number;
    smsLimit: number;
    storageBytes: string;
  } | null;
  usage: {
    activeSeats: number;
    smsSent: number;
    storageBytes: string;
  } | null;
};

type InvoiceRow = {
  unitId: string;
  amountPaise: number;
  taxPaise: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatBytes(bytes: string) {
  const n = Number(bytes);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${n} B`;
}

export function BillingPageClient() {
  const [subData, setSubData] = useState<SubData | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, plansRes, invRes] = await Promise.all([
        fetch("/api/billing/subscription"),
        fetch("/api/billing/plans"),
        fetch("/api/billing/invoices"),
      ]);
      const subJson = await subRes.json();
      const plansJson = await plansRes.json();
      const invJson = await invRes.json();
      if (subJson.ok) setSubData(subJson.data);
      if (plansJson.ok) setPlans(plansJson.data);
      if (invJson.ok) setInvoices(invJson.data);
    } catch {
      setError("Could not load billing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startCheckout(planCode: string) {
    if (!acceptTerms) {
      setError("Please accept the terms before checkout.");
      return;
    }
    setCheckoutPlan(planCode);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle, acceptTerms: true }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "Checkout failed");
        return;
      }

      const { razorpaySubscriptionId, keyId, planName } = json.data;
      if (!window.Razorpay) {
        setError("Payment SDK not loaded. Refresh and try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: razorpaySubscriptionId,
        name: "MEIYON",
        description: `${planName} — ${cycle}`,
        theme: { color: "#4F46E5" },
        handler: () => {
          load();
        },
      });
      rzp.open();
    } catch {
      setError("Checkout failed. Try again.");
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function cancelSub() {
    if (!confirm("Cancel subscription at period end?")) return;
    const res = await fetch("/api/billing/cancel", { method: "POST" });
    const json = await res.json();
    if (json.ok) load();
    else setError(json.error?.message ?? "Cancel failed");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const currentPlan = subData?.plan;
  const sub = subData?.subscription;
  const usage = subData?.usage;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="space-y-8">
        <PageHeader
          title="Billing & subscription"
          description="Manage your MEIYON plan, usage, and invoices. Payments processed securely via Razorpay."
        />

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {sub && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm ring-1 ring-zinc-200/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500">Current plan</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                  {currentPlan?.name ?? "—"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={sub.status} />
                  <span className="text-sm text-zinc-500 capitalize">
                    {sub.billingCycle} billing
                  </span>
                </div>
              </div>
              <CreditCard className="h-8 w-8 text-brand" />
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-zinc-400">Period ends</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-900">
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN")
                    : sub.trialEndsAt
                      ? `Trial ends ${new Date(sub.trialEndsAt).toLocaleDateString("en-IN")}`
                      : "—"}
                </dd>
              </div>
              {usage && currentPlan && (
                <>
                  <div>
                    <dt className="text-xs font-medium uppercase text-zinc-400">Seats</dt>
                    <dd className="mt-1 text-sm font-medium text-zinc-900">
                      {usage.activeSeats} / {currentPlan.seatLimit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-zinc-400">SMS this month</dt>
                    <dd className="mt-1 text-sm font-medium text-zinc-900">
                      {usage.smsSent} / {currentPlan.smsLimit}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {sub.status === "active" && (
              <Button variant="secondary" className="mt-4" onClick={cancelSub}>
                Cancel at period end
              </Button>
            )}
          </div>
        )}

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-zinc-900">Available plans</h3>
            <div className="flex rounded-lg border border-zinc-200 p-1">
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                    cycle === c
                      ? "bg-brand text-white"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to MEIYON{" "}
              <Link
                href={`${MARKETING_URL}/legal/terms`}
                className="text-brand underline"
                target="_blank"
              >
                Terms
              </Link>
              ,{" "}
              <Link
                href={`${MARKETING_URL}/legal/refund-policy`}
                className="text-brand underline"
                target="_blank"
              >
                Refund Policy
              </Link>
              , and authorize recurring billing via Razorpay.
            </span>
          </label>

          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const price =
                cycle === "yearly"
                  ? plan.yearlyPricePaise
                  : plan.monthlyPricePaise;
              const isCurrent = currentPlan?.code === plan.code;
              return (
                <div
                  key={plan.code}
                  className={`rounded-2xl border p-5 shadow-sm ring-1 ${
                    isCurrent
                      ? "border-brand/40 ring-brand/20"
                      : "border-zinc-200/80 ring-zinc-200/50"
                  } bg-white`}
                >
                  <h4 className="font-semibold text-zinc-900">{plan.name}</h4>
                  <p className="mt-2 text-2xl font-bold tracking-tight">
                    {formatInr(price)}
                    <span className="text-sm font-normal text-zinc-500">
                      /{cycle === "yearly" ? "year" : "month"}
                    </span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" />
                      {plan.seatLimit} seats
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" />
                      {plan.smsLimit.toLocaleString("en-IN")} SMS/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" />
                      {formatBytes(plan.storageBytes)} storage
                    </li>
                  </ul>
                  <Button
                    className="mt-4 w-full bg-brand hover:brightness-95"
                    disabled={isCurrent || checkoutPlan === plan.code}
                    onClick={() => startCheckout(plan.code)}
                  >
                    {checkoutPlan === plan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : (
                      "Upgrade / Subscribe"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {invoices.length > 0 && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-200/50">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h3 className="font-semibold text-zinc-900">Invoice history</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-zinc-500">
                    <th className="px-5 py-3 font-medium">Invoice</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">GST</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.unitId} className="border-b border-zinc-50 even:bg-zinc-50/50">
                      <td className="px-5 py-3 font-medium">{inv.unitId}</td>
                      <td className="px-5 py-3">{formatInr(inv.amountPaise)}</td>
                      <td className="px-5 py-3">{formatInr(inv.taxPaise)}</td>
                      <td className="px-5 py-3 capitalize">{inv.status}</td>
                      <td className="px-5 py-3 text-zinc-500">
                        {new Date(inv.paidAt ?? inv.createdAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
