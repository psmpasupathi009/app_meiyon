import { BillingPageClient } from "@/features/billing/components/billing-page";

export const metadata = {
  title: "Billing",
  description: "Manage your MEIYON subscription, usage, and invoices.",
};

export default function BillingPage() {
  return <BillingPageClient />;
}
