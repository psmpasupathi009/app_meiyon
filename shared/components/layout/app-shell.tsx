import { brand } from "@/config/company/brand";
import type { PublicUser } from "@/lib/auth/session";
import { SiteHeader } from "@/shared/components/layout/site-header";
import { SiteFooter } from "@/shared/components/layout/site-footer";
import { SiteSidebar } from "@/shared/components/layout/site-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type AppShellProps = {
  user: PublicUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  return (
    <SidebarProvider className="print:block">
      <SiteSidebar user={user} />
      <SidebarInset className="bg-background print:bg-white">
        <SiteHeader
          brandName={brand.name}
          user={user}
          className="print:hidden"
        />
        <main className="min-w-0 flex-1 overflow-x-auto print:overflow-visible">
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 print:max-w-none print:px-0 print:py-0">
            {children}
          </div>
        </main>
        <div className="print:hidden">
          <SiteFooter />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
