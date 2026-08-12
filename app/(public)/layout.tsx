import { SiteFooter } from "@/shared/components/layout/site-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
