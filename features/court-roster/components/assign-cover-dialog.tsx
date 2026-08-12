"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { DefaultCourt } from "@/lib/hearings/court-key";
import { CourtCascade } from "@/shared/components/pickers/court-cascade";
import { cn } from "@/lib/utils/cn";

type AdvocateOption = {
  unitId: string;
  displayName: string;
  mobile: string;
  available: boolean;
  message?: string;
  blockedOn?: string;
};

type AssignCoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When null, user picks the court in-dialog (bootstrap from empty roster). */
  court: DefaultCourt | null;
  defaultDate: string;
  onSaved: () => void;
};

const emptyCourt = (): DefaultCourt => ({
  state: "Tamil Nadu",
  district: "",
  city: "",
  courtName: "",
});

export function AssignCoverDialog({
  open,
  onOpenChange,
  court,
  defaultDate,
  onSaved,
}: AssignCoverDialogProps) {
  const pickCourt = !court;
  const [draftCourt, setDraftCourt] = useState<DefaultCourt>(court ?? emptyCourt());
  const [fromDate, setFromDate] = useState(defaultDate);
  const [toDate, setToDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [available, setAvailable] = useState<AdvocateOption[]>([]);
  const [unavailable, setUnavailable] = useState<AdvocateOption[]>([]);
  const [courtCoveredBy, setCourtCoveredBy] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveCourt = court ?? draftCourt;
  const courtReady =
    Boolean(effectiveCourt.state.trim()) &&
    Boolean(effectiveCourt.district.trim()) &&
    Boolean(effectiveCourt.city.trim()) &&
    Boolean(effectiveCourt.courtName.trim());

  const loadAdvocates = useCallback(async () => {
    if (!open || !courtReady) {
      setAvailable([]);
      setUnavailable([]);
      setCourtCoveredBy(null);
      return;
    }
    if (!fromDate || !toDate || fromDate > toDate) {
      setAvailable([]);
      setUnavailable([]);
      return;
    }
    setLoadingList(true);
    const params = new URLSearchParams({
      fromDate,
      toDate,
      state: effectiveCourt.state,
      district: effectiveCourt.district,
      city: effectiveCourt.city,
      courtName: effectiveCourt.courtName,
    });
    const { ok, data } = await apiFetch<{
      available: AdvocateOption[];
      unavailable: AdvocateOption[];
      courtCoveredBy: string | null;
    }>(`/api/court-roster/available-advocates?${params}`, undefined, 45000);
    setLoadingList(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load advocates")
      );
      return;
    }
    const body = data as {
      available?: AdvocateOption[];
      unavailable?: AdvocateOption[];
      courtCoveredBy?: string | null;
    };
    setAvailable(body.available ?? []);
    setUnavailable(body.unavailable ?? []);
    setCourtCoveredBy(body.courtCoveredBy ?? null);
    setSelectedUnitId((prev) => {
      const still = (body.available ?? []).some((a) => a.unitId === prev);
      return still ? prev : "";
    });
  }, [
    open,
    courtReady,
    fromDate,
    toDate,
    effectiveCourt.state,
    effectiveCourt.district,
    effectiveCourt.city,
    effectiveCourt.courtName,
  ]);

  useEffect(() => {
    if (!open) return;
    setDraftCourt(court ?? emptyCourt());
    setFromDate(defaultDate);
    setToDate(defaultDate);
    setReason("");
    setSelectedUnitId("");
    setError("");
    setCourtCoveredBy(null);
  }, [open, court, defaultDate]);

  useEffect(() => {
    void loadAdvocates();
  }, [loadAdvocates]);

  async function handleSubmit() {
    setError("");
    if (!courtReady) {
      setError("Select a complete court");
      return;
    }
    if (courtCoveredBy) {
      setError(
        `This court already has temporary cover (${courtCoveredBy}). End that cover first.`
      );
      return;
    }
    if (!selectedUnitId) {
      setError("Select an available advocate");
      return;
    }
    if (fromDate > toDate) {
      setError("End date must be on or after start date");
      return;
    }
    setBusy(true);
    const { ok, data } = await apiFetch("/api/court-roster/overrides", {
      method: "POST",
      json: {
        ...effectiveCourt,
        advocateUnitId: selectedUnitId,
        fromDate,
        toDate,
        reason: reason || undefined,
      },
    });
    setBusy(false);
    if (!ok) {
      setError(
        getErrorMessage(data as Record<string, unknown>, "Failed to assign cover")
      );
      return;
    }
    toast.success("Temporary cover assigned");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0">
        <DialogHeader className="shrink-0 border-b border-border/80 px-3 py-3 pr-11 sm:px-5 sm:py-4">
          <DialogTitle>Assign temporary cover</DialogTitle>
          <DialogDescription>
            {court
              ? `${court.courtName} · ${court.city}, ${court.district}`
              : "Pick a court, date range, and an advocate who is free."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {pickCourt ? (
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <Label>1. Court</Label>
              <CourtCascade
                state={draftCourt.state}
                district={draftCourt.district}
                city={draftCourt.city}
                courtName={draftCourt.courtName}
                onChange={(next) => setDraftCourt(next)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
              <p className="font-medium text-navy">{court?.courtName}</p>
              <p className="text-xs text-muted-foreground">
                {court?.city}, {court?.district}, {court?.state}
              </p>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <Label>{pickCourt ? "2. Date range" : "1. Date range"}</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">From</span>
                <DatePicker
                  value={fromDate}
                  onChange={(v) => {
                    setFromDate(v);
                    if (toDate < v) setToDate(v);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">To</span>
                <DatePicker value={toDate} onChange={setToDate} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover-reason" className="text-xs font-normal text-muted-foreground">
                Reason (optional)
              </Label>
              <Textarea
                id="cover-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Leave cover for Dinesh"
              />
            </div>
          </div>

          {courtCoveredBy ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              This court already has temporary cover ({courtCoveredBy}). End that
              cover first before assigning another.
            </p>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{pickCourt ? "3. Available advocates" : "2. Available advocates"}</Label>
              {loadingList ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Checking…
                </span>
              ) : courtReady ? (
                <span className="text-xs text-muted-foreground">
                  {available.length} free · {unavailable.length} busy
                </span>
              ) : null}
            </div>

            {!courtReady ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Select a court to see who is free.
              </p>
            ) : loadingList ? (
              <div className="space-y-2 rounded-lg border border-border/80 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
                ))}
              </div>
            ) : available.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No advocates free for this court and date range.
              </p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/80 p-1">
                {available.map((a) => {
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
                        <Badge variant="success" className="font-normal">
                          Free
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {unavailable.length > 0 && !loadingList ? (
            <details className="rounded-lg border border-border/60 bg-muted/10">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                Show {unavailable.length} unavailable advocate
                {unavailable.length === 1 ? "" : "s"}
              </summary>
              <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-border/50 px-2 py-2 text-xs text-muted-foreground">
                {unavailable.map((a) => (
                  <li
                    key={a.unitId}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="font-medium text-foreground/80">{a.displayName}</span>
                    <span>
                      {a.message}
                      {a.blockedOn ? ` · ${a.blockedOn}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/80 px-3 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !selectedUnitId || Boolean(courtCoveredBy) || loadingList}
          >
            {busy ? "Saving…" : "Assign cover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
