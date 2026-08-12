"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { CourtCascade } from "@/shared/components/pickers/court-cascade";
import type { CaseSummary } from "@/features/cases/server/serialize";
import {
  CASE_TYPE_GROUPS,
  isValidCnr,
  normalizeCnr,
} from "@meiyon/config";
import {
  getStageOptionsForCaseType,
  isKnownStageForCaseType,
} from "@meiyon/config";
import {
  UNDER_ACTS_OPTIONS,
  caseYearOptions,
} from "@/config/company/form-options";
import { OUR_SIDE_OPTIONS } from "@/lib/validations/cases.schema";
import { SelectOrOther } from "@/shared/components/forms/select-or-other";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { AdvocatePicker } from "@/features/employees/components/advocate-picker";
import { displayMobile } from "@/lib/auth/mobile";
import { cn } from "@/lib/utils/cn";

const CASE_TYPE_OPTIONS = CASE_TYPE_GROUPS.flatMap((g) =>
  g.types.map((t) => ({ value: t.value, label: t.label, group: g.group }))
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseItem?: (CaseSummary & { clientName?: string | null }) | null;
  defaultClient?: { unitId: string; name: string } | null;
  /** Called after save; for new cases, unitId is the created CSE id */
  onSaved: (createdUnitId?: string) => void;
};

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-border/80 bg-muted/15 p-4 sm:p-5",
        className
      )}
    >
      <div className="shrink-0">
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid min-w-0 content-start gap-3">{children}</div>
    </div>
  );
}

export function CaseFormDialog({
  open,
  onOpenChange,
  caseItem,
  defaultClient,
  onSaved,
}: Props) {
  const isEdit = Boolean(caseItem);

  const [client, setClient] = useState<{ unitId: string; name: string } | null>(
    null
  );
  const [caseNumber, setCaseNumber] = useState("");
  const [filingNumber, setFilingNumber] = useState("");
  const [caseYear, setCaseYear] = useState("");
  const [cnr, setCnr] = useState("");
  const [state, setState] = useState("Tamil Nadu");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [courtName, setCourtName] = useState("");
  const [primaryAdvocateMobile, setPrimaryAdvocateMobile] = useState("");
  const [primaryAdvocateLabel, setPrimaryAdvocateLabel] = useState<string | null>(
    null
  );
  const [opposingParty, setOpposingParty] = useState("");
  const [ourSide, setOurSide] = useState("");
  const [underActs, setUnderActs] = useState("");
  const [policeStation, setPoliceStation] = useState("");
  const [firNumber, setFirNumber] = useState("");
  const [stage, setStage] = useState("");
  const [caseType, setCaseType] = useState("");
  const [filingDate, setFilingDate] = useState("");
  const [nextHearingAt, setNextHearingAt] = useState("");
  const [agreedFee, setAgreedFee] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stageOptions = useMemo(
    () => getStageOptionsForCaseType(caseType || null),
    [caseType]
  );

  function handleCaseTypeChange(nextType: string) {
    setCaseType(nextType);
    setStage((prev) => {
      if (!prev) return prev;
      if (isKnownStageForCaseType(prev, nextType)) return prev;
      // Keep free-text "Other" values that were not from the previous catalog
      if (!isKnownStageForCaseType(prev, caseType || null)) return prev;
      return "";
    });
  }

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (caseItem) {
        setClient({
          unitId: caseItem.clientUnitId,
          name: caseItem.clientName ?? caseItem.clientUnitId,
        });
        setCaseNumber(caseItem.caseNumber ?? "");
        setFilingNumber(caseItem.filingNumber ?? "");
        setCaseYear(
          caseItem.caseYear != null ? String(caseItem.caseYear) : ""
        );
        setCnr(caseItem.cnr ?? "");
        setState(caseItem.state ?? "Tamil Nadu");
        setDistrict(caseItem.district ?? "");
        setCity(caseItem.city ?? "");
        setCourtName(caseItem.courtName ?? "");
        setPrimaryAdvocateMobile(caseItem.primaryAdvocateMobile ?? "");
        setPrimaryAdvocateLabel(
          caseItem.primaryAdvocateMobile
            ? `Advocate · ${caseItem.primaryAdvocateMobile}`
            : null
        );
        setOpposingParty(caseItem.opposingParty ?? "");
        setOurSide(caseItem.ourSide ?? "");
        setUnderActs(caseItem.underActs ?? "");
        setPoliceStation(caseItem.policeStation ?? "");
        setFirNumber(caseItem.firNumber ?? "");
        setStage(caseItem.stage ?? "");
        setCaseType(caseItem.caseType ?? "");
        setFilingDate(caseItem.filingDate ? caseItem.filingDate.slice(0, 10) : "");
        setNextHearingAt(
          caseItem.nextHearingAt ? caseItem.nextHearingAt.slice(0, 10) : ""
        );
        setAgreedFee(
          caseItem.agreedFee != null ? String(caseItem.agreedFee) : ""
        );
        setNotes(caseItem.notes ?? "");
      } else {
        setClient(defaultClient ?? null);
        setCaseNumber("");
        setFilingNumber("");
        setCaseYear("");
        setCnr("");
        setState("Tamil Nadu");
        setDistrict("");
        setCity("");
        setCourtName("");
        setPrimaryAdvocateMobile("");
        setPrimaryAdvocateLabel(null);
        setOpposingParty("");
        setOurSide("");
        setUnderActs("");
        setPoliceStation("");
        setFirNumber("");
        setStage("");
        setCaseType("");
        setFilingDate("");
        setNextHearingAt("");
        setAgreedFee("");
        setNotes("");
      }
      setError("");
    });
  }, [open, caseItem, defaultClient]);

  async function handleSubmit() {
    setError("");
    if (!isEdit && !client) {
      setError("Select or add a client");
      return;
    }
    if (!state || !district || !city || !courtName) {
      setError("Select state, district, court complex and court");
      return;
    }
    if (!caseType) {
      setError("Select case type");
      return;
    }
    if (!primaryAdvocateMobile.trim()) {
      setError("Select or enter primary advocate mobile");
      return;
    }
    if (cnr && !isValidCnr(cnr)) {
      setError("CNR must be 16 letters/digits (dashes optional)");
      return;
    }

    const digits = primaryAdvocateMobile.replace(/\D/g, "");
    const mobile10 =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 10
          ? digits
          : primaryAdvocateMobile.trim();

    setBusy(true);
    const payload = {
      ...(isEdit ? {} : { clientUnitId: client!.unitId }),
      caseNumber: caseNumber || undefined,
      filingNumber: filingNumber || undefined,
      caseYear: caseYear ? Number(caseYear) : undefined,
      cnr: cnr ? normalizeCnr(cnr) : undefined,
      state,
      district,
      city,
      courtName,
      primaryAdvocateMobile: mobile10,
      advocateMobiles: [mobile10],
      opposingParty: opposingParty || undefined,
      ourSide: ourSide || undefined,
      underActs: underActs || undefined,
      policeStation: policeStation || undefined,
      firNumber: firNumber || undefined,
      stage: stage || undefined,
      caseType,
      ...(isEdit ? {} : { status: "enquiry" as const }),
      filingDate: filingDate || undefined,
      nextHearingAt: nextHearingAt || undefined,
      agreedFee:
        agreedFee === ""
          ? undefined
          : Number.isFinite(Number(agreedFee))
            ? Number(agreedFee)
            : undefined,
      notes: notes || undefined,
    };

    const { ok, data } = await apiFetch(
      isEdit ? `/api/cases/${caseItem!.unitId}` : "/api/cases",
      { method: isEdit ? "PATCH" : "POST", json: payload }
    );
    setBusy(false);

    if (!ok) {
      setError(
        getErrorMessage(data as Record<string, unknown>, "Failed to save case")
      );
      return;
    }

    const created =
      data && typeof data === "object" && "case" in data
        ? (data as { case: { unitId: string } }).case
        : null;
    toast.success(
      isEdit
        ? "Case updated"
        : created?.unitId
          ? `Saved ${created.unitId} — upload documents on the case page`
          : "Case created"
    );
    onSaved(isEdit ? undefined : created?.unitId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0">
        <DialogHeader className="shrink-0 border-b border-border/80 px-3 py-3 pr-11 sm:px-5 sm:py-4 md:px-6">
          <DialogTitle>
            {isEdit ? "Edit case register" : "Case register — new entry"}
          </DialogTitle>
          <DialogDescription>
            Full office register — State → District → City → Court, then parties
            and numbers. Documents upload after save on the case page.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-2 md:gap-5">
            <Section
              title="1. Court location"
              description="State → District → City / town → Court"
              className="md:col-span-2"
            >
              <CourtCascade
                key={`${open}-${caseItem?.unitId ?? "new"}`}
                state={state}
                district={district}
                city={city}
                courtName={courtName}
                onChange={({
                  state: s,
                  district: d,
                  city: ci,
                  courtName: c,
                }) => {
                  setState(s);
                  setDistrict(d);
                  setCity(ci);
                  setCourtName(c);
                }}
              />
            </Section>

            <Section
              title="2. Our client"
              description="Who this office represents"
            >
              {isEdit ? (
                <div className="rounded-md border border-input bg-card px-3 py-3 text-sm">
                  <span className="font-medium text-navy">{client?.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    ({client?.unitId})
                  </span>
                </div>
              ) : (
                <ClientPicker value={client} onChange={setClient} />
              )}
            </Section>

            <Section
              title="3. Case type & status"
              description="Type is required — status list follows the case type"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>
                    Case type <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    value={caseType}
                    onChange={handleCaseTypeChange}
                    options={CASE_TYPE_OPTIONS}
                    grouped
                    placeholder="Select type"
                    searchPlaceholder="Search case type…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <SelectOrOther
                    value={stage}
                    onChange={setStage}
                    options={stageOptions}
                    placeholder={
                      caseType
                        ? "Select status"
                        : "Select case type first"
                    }
                    otherPlaceholder="Type status"
                    disabled={!caseType}
                  />
                </div>
              </div>
            </Section>

            <Section
              title="4. Case numbers"
              description="Fill when court allots — all optional for now"
              className="md:col-span-2"
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="cs-number">Court case number</Label>
                  <Input
                    id="cs-number"
                    className="h-11"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="OS/123/2024"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cs-filing-no">Filing number</Label>
                  <Input
                    id="cs-filing-no"
                    className="h-11"
                    value={filingNumber}
                    onChange={(e) => setFilingNumber(e.target.value)}
                    placeholder="Before registration"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Year</Label>
                  <SelectOrOther
                    value={caseYear}
                    onChange={setCaseYear}
                    options={caseYearOptions()}
                    placeholder="Select year"
                    otherPlaceholder="YYYY"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2 xl:col-span-2">
                  <Label htmlFor="cs-cnr">CNR (eCourts)</Label>
                  <Input
                    id="cs-cnr"
                    className="h-11"
                    value={cnr}
                    onChange={(e) => setCnr(e.target.value.toUpperCase())}
                    placeholder="16 chars, e.g. TNCH012345678901"
                    maxLength={20}
                  />
                </div>
              </div>
            </Section>

            <Section
              title="5. Parties & advocate"
              description="Our side, opposite party, acts, advocate"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Our client appears as</Label>
                  <Select
                    value={ourSide || undefined}
                    onValueChange={setOurSide}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Petitioner / accused…" />
                    </SelectTrigger>
                    <SelectContent className="z-200">
                      {OUR_SIDE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cs-opposing">Opposite party</Label>
                  <Input
                    id="cs-opposing"
                    className="h-11"
                    value={opposingParty}
                    onChange={(e) => setOpposingParty(e.target.value)}
                    placeholder="Respondent / accused"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Under acts / sections</Label>
                  <SelectOrOther
                    value={underActs}
                    onChange={setUnderActs}
                    options={UNDER_ACTS_OPTIONS}
                    placeholder="Select act / statute"
                    otherPlaceholder="e.g. Sec 138 NI Act · IPC 420"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cs-ps">Police station</Label>
                  <Input
                    id="cs-ps"
                    className="h-11"
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                    placeholder="Criminal matters"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cs-fir">FIR / Crime number</Label>
                  <Input
                    id="cs-fir"
                    className="h-11"
                    value={firNumber}
                    onChange={(e) => setFirNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>
                    Primary advocate{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <AdvocatePicker
                    value={primaryAdvocateMobile || null}
                    selectedLabel={primaryAdvocateLabel}
                    onChange={(a) => {
                      if (!a) {
                        setPrimaryAdvocateMobile("");
                        setPrimaryAdvocateLabel(null);
                        return;
                      }
                      const m = displayMobile(a.mobile);
                      setPrimaryAdvocateMobile(m);
                      setPrimaryAdvocateLabel(
                        `${a.displayName || a.name || "Advocate"} · ${m}`
                      );
                      const courtEmpty =
                        !district.trim() && !city.trim() && !courtName.trim();
                      const primary = a.defaultCourts?.[0];
                      if (courtEmpty && primary) {
                        setState(primary.state || "Tamil Nadu");
                        setDistrict(primary.district);
                        setCity(primary.city);
                        setCourtName(primary.courtName);
                      }
                    }}
                    valueBy="mobile"
                    placeholder="Select advocate"
                  />
                  <Input
                    className="h-11"
                    value={primaryAdvocateMobile}
                    onChange={(e) => {
                      setPrimaryAdvocateMobile(e.target.value);
                      setPrimaryAdvocateLabel(null);
                    }}
                    placeholder="Or type 10-digit mobile"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </Section>

            <Section
              title="6. Dates & fee"
              description="Optional"
              className="md:col-span-2"
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="grid min-w-0 gap-2">
                  <Label>Filing date</Label>
                  <DatePicker value={filingDate} onChange={setFilingDate} />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label>Next hearing</Label>
                  <DatePicker value={nextHearingAt} onChange={setNextHearingAt} />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="cs-fee">Agreed fee (₹)</Label>
                  <Input
                    id="cs-fee"
                    type="number"
                    min={0}
                    value={agreedFee}
                    onChange={(e) => setAgreedFee(e.target.value)}
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="cs-notes">Notes</Label>
                  <Input
                    id="cs-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brief facts"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Documents (vakalatnama, petition, judgment…) upload on the case
                page after save — PDF / JPG / PNG up to 10 MB.
              </p>
            </Section>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/80 bg-muted/30 px-4 py-3 sm:px-6 sm:py-4 sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Required: court location, client, case type, advocate
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={busy}>
              {busy
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Save & create CSE id"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
