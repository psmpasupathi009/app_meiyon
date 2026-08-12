"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Search, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch, getErrorCode, getErrorMessage } from "@/lib/api/client";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";

type SearchResult = {
  employees: {
    unitId: string;
    name: string | null;
    mobile: string | null;
    designation: string | null;
  }[];
  clients: {
    unitId: string;
    name: string | null;
    mobile: string | null;
  }[];
  cases: {
    unitId: string;
    caseNumber: string | null;
    status: string;
    opposingParty: string | null;
  }[];
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const query = debounced.trim();
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { ok, data, status } = await apiFetch<SearchResult>(
        `/api/search?q=${encodeURIComponent(query)}`
      );
      if (cancelled) return;
      setLoading(false);
      if (!ok) {
        setResults({ employees: [], clients: [], cases: [] });
        if (status === 429 || getErrorCode(data) === "RATE_LIMITED") {
          toast.error(getErrorMessage(data, "Too many searches. Slow down."));
        }
        return;
      }
      setResults(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    setResults(null);
    router.push(href);
  }

  const empty =
    results &&
    results.employees.length === 0 &&
    results.clients.length === 0 &&
    results.cases.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-navy hover:bg-muted hover:text-navy"
        aria-label="Search"
        title="Search (⌘K)"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setQ("");
            setResults(null);
          }
        }}
      >
        <DialogContent size="md" className="gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border px-3 py-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients, cases, staff…"
              className="h-11 border-0 shadow-none focus-visible:ring-0"
              aria-label="Search query"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters
              </p>
            ) : loading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Searching…
              </p>
            ) : empty ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No matches
              </p>
            ) : (
              <div className="space-y-3">
                {results?.clients.length ? (
                  <ResultGroup title="Clients" icon={Users}>
                    {results.clients.map((c) => (
                      <ResultRow
                        key={c.unitId}
                        onClick={() => go(`/clients/${c.unitId}`)}
                        primary={c.name ?? c.unitId}
                        secondary={
                          c.mobile ? `+91 ${c.mobile} · ${c.unitId}` : c.unitId
                        }
                      />
                    ))}
                  </ResultGroup>
                ) : null}
                {results?.cases.length ? (
                  <ResultGroup title="Cases" icon={Briefcase}>
                    {results.cases.map((c) => (
                      <ResultRow
                        key={c.unitId}
                        onClick={() => go(`/cases/${c.unitId}`)}
                        primary={c.caseNumber?.trim() || c.unitId}
                        secondary={[c.status, c.opposingParty, c.unitId]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ))}
                  </ResultGroup>
                ) : null}
                {results?.employees.length ? (
                  <ResultGroup title="Staff" icon={UserRound}>
                    {results.employees.map((e) => (
                      <ResultRow
                        key={e.unitId}
                        onClick={() =>
                          go(`/employees?q=${encodeURIComponent(e.unitId)}`)
                        }
                        primary={e.name ?? e.unitId}
                        secondary={
                          [e.designation, e.mobile ? `+91 ${e.mobile}` : null, e.unitId]
                            .filter(Boolean)
                            .join(" · ")
                        }
                      />
                    ))}
                  </ResultGroup>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  primary,
  secondary,
  onClick,
}: {
  primary: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors",
          "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        )}
      >
        <span className="truncate text-sm font-medium text-navy">{primary}</span>
        <span className="truncate text-xs text-muted-foreground">{secondary}</span>
      </button>
    </li>
  );
}
