"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { DefaultCourt } from "@/lib/hearings/court-key";
import type { CoverAdvocate } from "@/features/court-roster/lib/effective-cover";
import { cn } from "@/lib/utils/cn";

type AdvocateOption = {
  unitId: string;
  displayName: string;
  mobile: string;
};

type EditPermanentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  court: DefaultCourt | null;
  permanent: CoverAdvocate[];
  onSaved: () => void;
};

async function loadAllAdvocates(): Promise<AdvocateOption[]> {
  const all: AdvocateOption[] = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total && page <= 20) {
    const { ok, data } = await apiFetch<{
      data: Array<{
        unitId: string;
        displayName: string;
        mobile: string;
        roles: string[];
      }>;
      meta: { total: number };
    }>(`/api/employees?role=advocate&status=active&page=${page}&pageSize=50`);
    if (!ok) {
      throw new Error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load advocates")
      );
    }
    const body = data as {
      data?: Array<{
        unitId: string;
        displayName: string;
        mobile: string;
        roles: string[];
      }>;
      meta?: { total: number };
    };
    const chunk = (body.data ?? []).filter((a) => a.roles.includes("advocate"));
    all.push(
      ...chunk.map((a) => ({
        unitId: a.unitId,
        displayName: a.displayName,
        mobile: a.mobile,
      }))
    );
    total = body.meta?.total ?? all.length;
    if (chunk.length === 0) break;
    page += 1;
  }
  all.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return all;
}

export function EditPermanentDialog({
  open,
  onOpenChange,
  court,
  permanent,
  onSaved,
}: EditPermanentDialogProps) {
  const [advocates, setAdvocates] = useState<AdvocateOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const loadAdvocates = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      setAdvocates(await loadAllAdvocates());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load advocates");
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedUnitId("");
    setError("");
    setHint("");
    void loadAdvocates();
  }, [open, court, loadAdvocates]);

  async function assign(action: "add" | "remove", advocateUnitId: string) {
    if (!court) return;
    setError("");
    setHint("");
    setBusy(true);
    const { ok, data } = await apiFetch("/api/court-roster/permanent", {
      method: "POST",
      json: {
        action,
        advocateUnitId,
        ...court,
      },
    });
    setBusy(false);
    if (!ok) {
      const message = getErrorMessage(
        data as Record<string, unknown>,
        action === "add" ? "Failed to add advocate" : "Failed to remove advocate"
      );
      setError(message);
      if (action === "remove" && /at least one default court/i.test(message)) {
        setHint(
          "This is their only default court. Add another court on their employee profile first, then remove them here."
        );
      }
      return;
    }
    toast.success(action === "add" ? "Advocate added to court" : "Advocate removed");
    onSaved();
    if (action === "add") setSelectedUnitId("");
  }

  const permanentIds = new Set(permanent.map((p) => p.unitId));
  const candidates = advocates.filter((a) => !permanentIds.has(a.unitId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0">
        <DialogHeader className="shrink-0 border-b border-border/80 px-3 py-3 pr-11 sm:px-5 sm:py-4">
          <DialogTitle>Edit permanent followers</DialogTitle>
          <DialogDescription>
            {court
              ? `${court.courtName} · ${court.city}, ${court.district}`
              : "Update who usually covers this court"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {court ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
              <p className="font-medium text-navy">{court.courtName}</p>
              <p className="text-xs text-muted-foreground">
                {court.city}, {court.district}, {court.state}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Currently following</Label>
              <span className="text-xs text-muted-foreground">
                {permanent.length} advocate{permanent.length === 1 ? "" : "s"}
              </span>
            </div>
            {permanent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                No permanent followers yet. Add an advocate below.
              </p>
            ) : (
              <ul className="space-y-1">
                {permanent.map((p) => (
                  <li
                    key={p.unitId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-navy">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate font-medium">{p.displayName}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void assign("remove", p.unitId)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <Label>Add advocate</Label>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All active advocates already follow this court (or none found).
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/80 p-1">
                {candidates.map((a) => {
                  const selected = selectedUnitId === a.unitId;
                  return (
                    <li key={a.unitId}>
                      <button
                        type="button"
                        onClick={() => setSelectedUnitId(a.unitId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "bg-navy/10 text-navy ring-1 ring-navy/20"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {a.displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.displayName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {a.mobile}
                          </span>
                        </span>
                        {selected ? <Badge variant="outline">Selected</Badge> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !selectedUnitId || loading}
              onClick={() => void assign("add", selectedUnitId)}
            >
              Add to court
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {hint ? (
            <p className="text-sm text-muted-foreground">
              {hint}{" "}
              <Link href="/employees" className="underline underline-offset-2">
                Open Employees
              </Link>
            </p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/80 px-3 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
