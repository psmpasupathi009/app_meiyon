"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  group?: string;
  icon?: ReactNode;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export type ProductNavItem = {
  href: string;
  label: string;
};

export type ProductNavSection = {
  id: string;
  name: string;
  href: string;
  enabled?: boolean;
  nav: ProductNavItem[];
};

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function isNavActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
  nested,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group mb-0.5 flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-all duration-150",
        nested ? "pl-8 pr-3" : "px-3",
        active
          ? "border-l-2 border-brand bg-brand/10 text-navy"
          : "border-l-2 border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {icon && (
        <span
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-brand" : "text-zinc-400 group-hover:text-zinc-600"
          )}
        >
          {icon}
        </span>
      )}
      {label}
    </Link>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────

export function AppShell({
  brand,
  brandInitial,
  subtitle,
  subtitleBadge,
  nav,
  navGroups,
  products,
  userName,
  userMeta,
  logoutAction,
  banner,
  children,
}: {
  brand: string;
  brandInitial?: string;
  subtitle?: string;
  subtitleBadge?: string;
  nav?: NavItem[];
  navGroups?: NavGroup[];
  products?: ProductNavSection[];
  userName: string;
  userMeta?: string;
  logoutAction?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const product of products ?? []) {
        if (pathname === product.href || pathname.startsWith(`${product.href}/`)) {
          initial[product.id] = true;
        }
      }
      return initial;
    }
  );

  function isProductExpanded(product: ProductNavSection) {
    const onProduct =
      pathname === product.href || pathname.startsWith(`${product.href}/`);
    return onProduct || Boolean(expandedProducts[product.id]);
  }

  function toggleProduct(product: ProductNavSection) {
    setExpandedProducts((prev) => ({
      ...prev,
      [product.id]: !isProductExpanded(product),
    }));
  }

  function renderNavGroups(
    groups: NavGroup[],
    onNavigate?: () => void
  ) {
    return groups.map((group) => (
      <div key={group.id} className="mb-5">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          {group.label}
        </p>
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))
            }
            onNavigate={onNavigate}
            icon={item.icon}
          />
        ))}
      </div>
    ));
  }

  function renderProducts(onNavigate?: () => void) {
    if (!products?.length) return null;

    return (
      <div className="mb-5">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Products
        </p>
        {products.map((product) => {
          const enabled = product.enabled !== false;
          const expanded = enabled && isProductExpanded(product);
          const productActive =
            pathname === product.href || pathname.startsWith(`${product.href}/`);

          if (!enabled) {
            return (
              <div
                key={product.id}
                className="mb-0.5 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-zinc-400"
              >
                <span>{product.name}</span>
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <div key={product.id} className="mb-1">
              <div className="flex items-center gap-0.5">
                <Link
                  href={product.href}
                  onClick={() => {
                    setExpandedProducts((prev) => ({ ...prev, [product.id]: true }));
                    onNavigate?.();
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150",
                    productActive
                      ? "bg-brand/10 text-navy"
                      : "text-zinc-800 hover:bg-zinc-100"
                  )}
                >
                  {product.name}
                </Link>
                <button
                  type="button"
                  aria-label={expanded ? `Collapse ${product.name}` : `Expand ${product.name}`}
                  aria-expanded={expanded}
                  onClick={() => toggleProduct(product)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={cn("transition-transform", expanded && "rotate-90")}
                    aria-hidden
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
              {expanded &&
                product.nav.map((item) => (
                  <NavLink
                    key={`${product.id}-${item.href}-${item.label}`}
                    href={item.href}
                    label={item.label}
                    nested
                    active={
                      item.href === product.href
                        ? pathname === item.href
                        : isNavActive(pathname, item.href)
                    }
                    onNavigate={onNavigate}
                  />
                ))}
            </div>
          );
        })}
      </div>
    );
  }

  function renderNav(onNavigate?: () => void) {
    if (navGroups || products) {
      return (
        <>
          {navGroups ? renderNavGroups(navGroups.filter((g) => g.id !== "account"), onNavigate) : null}
          {renderProducts(onNavigate)}
          {navGroups
            ? renderNavGroups(
                navGroups.filter((g) => g.id === "account"),
                onNavigate
              )
            : null}
          {!navGroups &&
            nav?.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                }
                onNavigate={onNavigate}
              />
            ))}
        </>
      );
    }

    return nav?.map((item) => (
      <NavLink
        key={item.href}
        href={item.href}
        label={item.label}
        active={
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href))
        }
        onNavigate={onNavigate}
      />
    ));
  }

  const initial = (brandInitial ?? brand.charAt(0) ?? "?").toUpperCase();

  function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-zinc-100 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-extrabold text-white">
              {initial}
            </span>
            <p className="text-sm font-bold tracking-tight text-zinc-900">{brand}</p>
          </div>
          {subtitle && (
            <div className="mt-2 flex items-center gap-2">
              <p className="truncate text-xs font-medium text-zinc-600">{subtitle}</p>
              {subtitleBadge && (
                <span className="shrink-0 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-navy ring-1 ring-brand/20">
                  {subtitleBadge}
                </span>
              )}
            </div>
          )}
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-3">{renderNav(onNavigate)}</nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Desktop sidebar — sticky full height so layout does not collapse */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-zinc-200 bg-white lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{userName}</p>
              {userMeta && <p className="truncate text-xs text-zinc-400">{userMeta}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {logoutAction}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-navy">
              {getInitials(userName)}
            </div>
          </div>
        </header>

        {banner}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-zinc-400">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-zinc-600 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-zinc-600 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center sm:p-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
        <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
        </svg>
      </div>
      <h2 className="mt-4 text-base font-semibold text-zinc-800">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm", className)}>
      {children}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };
  const variants = {
    primary: "bg-brand text-white hover:brightness-95 shadow-sm",
    secondary: "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-sm",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150"
        {...props}
      />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  href,
  trend,
  trendDirection,
  description,
}: {
  label: string;
  value: string | number;
  href?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  description?: string;
}) {
  const trendColor =
    trendDirection === "up"
      ? "text-emerald-600"
      : trendDirection === "down"
      ? "text-rose-600"
      : "text-zinc-400";

  const inner = (
    <div className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
        {trend && (
          <span className={cn("flex items-center gap-0.5 text-sm font-medium", trendColor)}>
            {trendDirection === "up" && "↑"}
            {trendDirection === "down" && "↓"}
            {trend}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-xs text-zinc-400">{description}</p>}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm">
      {inner}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function Table({
  headers,
  rows,
  hideOnMobile = [],
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
  /** Column indices (0-based) hidden below the `md` breakpoint. */
  hideOnMobile?: number[];
}) {
  const cellVisibility = (index: number) =>
    hideOnMobile.includes(index) ? "hidden md:table-cell" : undefined;

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200/50 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/80">
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400",
                  cellVisibility(i),
                  i === 0 && "min-w-0"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50",
                i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"
              )}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3 text-zinc-700",
                    cellVisibility(j),
                    j === 0 && "min-w-0 max-w-[14rem] sm:max-w-xs"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const statusConfig: Record<string, { dot: string; text: string; bg: string }> = {
  active: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  trialing: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  past_due: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  suspended: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
  canceled: { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100" },
  cancelled: { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100" },
  expired: { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100" },
  paid: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  draft: { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100" },
  new: { dot: "bg-brand", text: "text-navy", bg: "bg-brand/10" },
  contacted: { dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50" },
  converted: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  closed: { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    dot: "bg-zinc-400",
    text: "text-zinc-600",
    bg: "bg-zinc-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.bg,
        config.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {status.replace("_", " ")}
    </span>
  );
}

// ─── ForbiddenState ──────────────────────────────────────────────────────────

export function ForbiddenState() {
  return (
    <EmptyState
      title="Access denied"
      description="You don't have permission to view this module."
    />
  );
}

// ─── UpgradePrompt ───────────────────────────────────────────────────────────

export function UpgradePrompt({ module: mod }: { module: string }) {
  return (
    <EmptyState
      title="Upgrade required"
      description={`${mod} is not included in your current plan. Visit Billing to upgrade.`}
    />
  );
}
