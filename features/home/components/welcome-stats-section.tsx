import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import type {
  AttentionItem,
  MetricItem,
} from "@/features/home/components/welcome-helpers";

export type WelcomeStatsSectionProps = {
  loading: boolean;
  metrics: MetricItem[];
  attention: AttentionItem[];
};

export function WelcomeStatsSection({
  loading,
  metrics,
  attention,
}: WelcomeStatsSectionProps) {
  return (
    <>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border/80 bg-card"
            />
          ))}
        </div>
      ) : metrics.length > 0 ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.label} href={m.href} className="group block">
                <Card className="h-full transition-colors group-hover:border-navy/30">
                  <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {m.label}
                      </p>
                      <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-navy">
                        {m.value}
                      </p>
                      {m.hint ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {m.hint}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-lg bg-secondary p-2.5 text-navy transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                      <Icon className="size-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}

      {!loading ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-navy">Action queue</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Items that need a decision before the day runs
            </p>
          </div>
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/40 sm:px-5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-navy">All clear</p>
                <p className="text-xs text-muted-foreground">
                  No blockers on the board right now.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead className="hidden sm:table-cell">Detail</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attention.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            item.tone === "danger" &&
                              "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
                            item.tone === "warning" &&
                              "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                            item.tone === "info" && "bg-secondary text-navy"
                          )}
                        >
                          <AlertTriangle className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-navy">
                            {item.label}
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {item.value}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <Link href={item.href}>
                          {item.cta}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}
    </>
  );
}
