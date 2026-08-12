"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiFetch,
  getErrorCode,
  getErrorMessage,
} from "@/lib/api/client";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { CasePicker } from "@/features/cases/components/case-picker";
import {
  AdvocatePicker,
  type AdvocateSummary,
} from "@/features/employees/components/advocate-picker";
import type { AppointmentSummary } from "@/features/appointments/server/serialize";
import { APPOINTMENT_MODE_OPTIONS } from "@/lib/validations/appointments.schema";
import {
  APPOINTMENT_DURATION_OPTIONS,
  APPOINTMENT_TITLE_OPTIONS,
} from "@/config/company/form-options";
import { SelectOrOther } from "@/shared/components/forms/select-or-other";
import { AvailabilitySlotPicker } from "@/features/availability/components/availability-slot-picker";
import type { PublicUser } from "@/lib/auth/session";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { displayMobile } from "@/lib/auth/mobile";
import { PersonChip } from "@/shared/components/user/person-chip";
import { personDisplayName } from "@/shared/lib/person";
import { cn } from "@/lib/utils/cn";

export type AppointmentFormMode = "create" | "edit" | "reschedule";

function tenDigit(mobile: string): string {
  return displayMobile(mobile);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(mode: string | null | undefined): string {
  return (
    APPOINTMENT_MODE_OPTIONS.find((m) => m.value === mode)?.label ??
    mode ??
    "Office visit"
  );
}

const CONFLICT_HINTS: Record<string, string> = {
  ADVOCATE_BUSY: "That advocate is already booked then — pick another free slot.",
  CLIENT_BUSY: "This client already has an appointment then — pick another time.",
  OUTSIDE_HOURS: "Outside working hours — check Availability.",
  BLOCKED: "Blocked on the advocate’s diary (court, travel, or break).",
  ON_LEAVE: "Advocate is on approved leave that day.",
  OFFICE_CLOSED: "Office is closed that day (holiday) — pick another date.",
  IN_PAST: "Choose a future time.",
};

function FormSection({
  step,
  title,
  description,
  children,
  className,
}: {
  step?: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {step != null ? (
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function ModePicker({
  value,
  onChange,
  options = APPOINTMENT_MODE_OPTIONS,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: readonly { value: string; label: string }[];
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2",
        options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      )}
    >
      {options.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition-colors sm:text-sm",
              active
                ? "border-brand bg-brand text-brand-foreground shadow-sm"
                : "border-border bg-muted/40 text-navy hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  formMode = "create",
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentSummary | null;
  formMode?: AppointmentFormMode;
  user: PublicUser;
  onSaved: () => void;
}) {
  const isCreate = formMode === "create";
  const isEditOnly = formMode === "edit";
  const isReschedule = formMode === "reschedule";
  const bookAny = canBookForAnyAdvocate(user.roles);
  const clientPortal = isClientOnlyUser(user.roles);
  const modeOptions = clientPortal
    ? APPOINTMENT_MODE_OPTIONS.filter((m) => m.value !== "video")
    : APPOINTMENT_MODE_OPTIONS;
  const selfMobile10 = tenDigit(user.mobile);

  const [client, setClient] = useState<{ unitId: string; name: string } | null>(
    null
  );
  const [linkedCase, setLinkedCase] = useState<{
    unitId: string;
    label: string;
  } | null>(null);
  const [selectedAdvocate, setSelectedAdvocate] =
    useState<AdvocateSummary | null>(null);
  const [advocateMobile, setAdvocateMobile] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [mode, setMode] = useState("office");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const originalAdvocateMobile = appointment?.advocateMobile
    ? tenDigit(appointment.advocateMobile)
    : "";

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setClient(
        clientPortal && user.clientUnitId
          ? {
              unitId: user.clientUnitId,
              name: user.name ?? user.clientUnitId,
            }
          : appointment?.clientUnitId
            ? {
                unitId: appointment.clientUnitId,
                name: appointment.clientName ?? appointment.clientUnitId,
              }
            : null
      );
      setLinkedCase(
        appointment?.caseUnitId
          ? {
              unitId: appointment.caseUnitId,
              label: appointment.caseUnitId,
            }
          : null
      );
      if (bookAny) {
        const mobile = appointment?.advocateMobile
          ? tenDigit(appointment.advocateMobile)
          : "";
        setAdvocateMobile(mobile);
        setSelectedAdvocate(
          mobile
            ? {
                unitId: appointment?.advocateUnitId ?? "",
                name: appointment?.advocateName ?? null,
                displayName: appointment?.advocateName ?? undefined,
                mobile: appointment?.advocateMobile ?? mobile,
                photoUrl: appointment?.advocatePhotoUrl,
              }
            : null
        );
      } else {
        setAdvocateMobile(selfMobile10);
        setSelectedAdvocate(null);
      }
      setTitle(appointment?.title ?? "");
      setScheduledAt("");
      setDurationMin(String(appointment?.durationMin ?? 30));
      setMode(appointment?.mode ?? "office");
      setNotes(appointment?.notes ?? "");
      setError("");
    });
  }, [open, appointment, bookAny, selfMobile10, clientPortal, user.clientUnitId, user.name]);

  const originalAdvocate = useMemo(() => {
    if (!appointment?.advocateMobile) return null;
    return {
      unitId: appointment.advocateUnitId ?? "",
      name: appointment.advocateName,
      displayName: appointment.advocateName,
      mobile: appointment.advocateMobile,
      photoUrl: appointment.advocatePhotoUrl,
    };
  }, [appointment]);

  const effectiveAdvocateMobile = bookAny ? advocateMobile : selfMobile10;

  const advocateChanged =
    isReschedule &&
    Boolean(originalAdvocateMobile) &&
    tenDigit(effectiveAdvocateMobile) !== originalAdvocateMobile;

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!isEditOnly && !scheduledAt) {
      setError("Pick a free date and time");
      return;
    }
    if ((isCreate || isReschedule) && bookAny && !advocateMobile.trim()) {
      setError("Select an advocate");
      return;
    }

    setBusy(true);

    let payload: Record<string, unknown>;

    if (isEditOnly) {
      payload = {
        clientUnitId: client?.unitId || "",
        caseUnitId: linkedCase?.unitId || "",
        title,
        durationMin: Number(durationMin) || 30,
        mode,
        notes: notes || undefined,
      };
    } else {
      payload = {
        clientUnitId: client?.unitId || undefined,
        caseUnitId: linkedCase?.unitId || undefined,
        advocateMobile: bookAny ? tenDigit(advocateMobile) : selfMobile10,
        title,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMin: Number(durationMin) || 30,
        mode,
        notes: notes || undefined,
        ...(isReschedule ? { status: "scheduled" as const } : {}),
      };
    }

    const { ok, data } = await apiFetch(
      isCreate
        ? "/api/appointments"
        : `/api/appointments/${appointment!.unitId}`,
      { method: isCreate ? "POST" : "PATCH", json: payload }
    );
    setBusy(false);

    if (!ok) {
      const code = getErrorCode(data) ?? "";
      setError(
        CONFLICT_HINTS[code] ??
          getErrorMessage(
            data as Record<string, unknown>,
            "Failed to save appointment"
          )
      );
      return;
    }

    if (isReschedule && advocateChanged && selectedAdvocate) {
      const name = personDisplayName({
        name: selectedAdvocate.displayName || selectedAdvocate.name,
        mobile: selectedAdvocate.mobile,
        unitId: selectedAdvocate.unitId,
      });
      toast.success(`Moved to ${name} — previous slot is available again`);
    } else if (isReschedule) {
      toast.success("Rescheduled — previous slot is available again");
    } else if (isEditOnly) {
      toast.success("Appointment updated");
    } else {
      toast.success("Appointment scheduled");
    }
    onSaved();
    onOpenChange(false);
  }

  const dialogTitle = isReschedule
    ? "Reschedule / hand off"
    : isEditOnly
      ? "Edit appointment"
      : "Book appointment";

  const dialogDescription = isReschedule
    ? bookAny
      ? "Send this booking to another advocate or a new time. The old diary slot opens for others."
      : "Pick a new free slot on your diary. Ask office staff to hand off to another advocate."
    : isEditOnly
      ? "Update client, title, mode, or notes. Use Reschedule to change advocate or time."
      : clientPortal
        ? "Book an office visit or phone call with an advocate. Only free slots are shown."
        : "Client called — book into the advocate diary. Only free slots are shown.";

  const submitLabel = busy
    ? "Saving…"
    : isReschedule
      ? "Move appointment"
      : isEditOnly
        ? "Save changes"
        : "Book appointment";

  const dialogSize = isEditOnly ? "md" : "lg";

  function renderAdvocateSelect(label: string) {
    const advocateLabel = selectedAdvocate
      ? selectedAdvocate.displayName ||
        personDisplayName({
          name: selectedAdvocate.name,
          mobile: selectedAdvocate.mobile,
          unitId: selectedAdvocate.unitId,
        })
      : null;

    return (
      <div className="grid gap-2">
        <Label>
          {label} <span className="text-destructive">*</span>
        </Label>
        {bookAny ? (
          <AdvocatePicker
            value={advocateMobile || null}
            selectedLabel={advocateLabel}
            onChange={(a) => {
              setSelectedAdvocate(a);
              setAdvocateMobile(a ? tenDigit(a.mobile) : "");
              setScheduledAt("");
            }}
            valueBy="mobile"
            placeholder="Select advocate by name"
          />
        ) : (
          <>
            <div className="rounded-md border border-input bg-muted/30 px-3 py-2.5">
              <PersonChip
                name={user.name}
                photoUrl={user.photoUrl}
                mobile={user.mobile}
                unitId={user.unitId}
                subtitle={`+91 ${selfMobile10}`}
                fallback="You"
              />
            </div>
            {isReschedule ? (
              <p className="text-xs text-muted-foreground">
                You can only move this on your own diary. Ask office staff to
                assign another advocate.
              </p>
            ) : null}
          </>
        )}
        {bookAny && selectedAdvocate && isReschedule ? (
          <p className="text-xs text-muted-foreground">
            {advocateChanged
              ? `Handing off to ${personDisplayName({
                  name:
                    selectedAdvocate.displayName || selectedAdvocate.name,
                  mobile: selectedAdvocate.mobile,
                  unitId: selectedAdvocate.unitId,
                })}`
              : "Same advocate — choosing a new time only"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={dialogSize} className="p-0">
        <DialogHeader className="bg-linear-to-b from-navy/4 to-transparent">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 bg-muted/20">
          {isReschedule && appointment ? (
            <FormSection
              title="Current booking"
              description="What you are moving — old slot frees after save"
            >
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium text-navy">
                    {appointment.clientName ??
                      appointment.clientUnitId ??
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Advocate</p>
                  {originalAdvocate ? (
                    <PersonChip
                      name={
                        originalAdvocate.displayName || originalAdvocate.name
                      }
                      photoUrl={originalAdvocate.photoUrl}
                      mobile={originalAdvocate.mobile}
                      unitId={originalAdvocate.unitId || undefined}
                      className="mt-0.5"
                    />
                  ) : (
                    <p className="font-medium text-navy">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">When</p>
                  <p className="font-medium text-navy">
                    {formatWhen(appointment.scheduledAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="font-medium text-navy">
                    {modeLabel(appointment.mode)}
                  </p>
                </div>
              </div>
            </FormSection>
          ) : null}

          {isReschedule ? (
            <FormSection
              step={1}
              title="Assign to"
              description={
                bookAny
                  ? "Pick who should take this meeting"
                  : "Your diary only"
              }
            >
              {renderAdvocateSelect("Advocate")}
            </FormSection>
          ) : null}

          {isCreate ? (
            <FormSection
              step={1}
              title="Client & purpose"
              description={
                clientPortal
                  ? "What is this appointment for?"
                  : "Who called, and why"
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                {clientPortal ? (
                  <div className="grid gap-2">
                    <Label>You</Label>
                    <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-navy">
                      {user.name ?? "Client"}
                      {user.clientUnitId ? ` · ${user.clientUnitId}` : ""}
                    </p>
                  </div>
                ) : (
                  <ClientPicker
                    value={client}
                    onChange={(c) => {
                      setClient(c);
                      setScheduledAt("");
                    }}
                    label="Client (recommended for call-ins)"
                  />
                )}
                <div className="grid gap-2">
                  <Label>Title / purpose</Label>
                  <SelectOrOther
                    value={title}
                    onChange={setTitle}
                    options={APPOINTMENT_TITLE_OPTIONS}
                    placeholder="Select title"
                    className="h-11"
                    otherPlaceholder="Custom title"
                  />
                </div>
                {!clientPortal ? (
                  <div className="md:col-span-2">
                    <CasePicker
                      value={linkedCase}
                      onChange={setLinkedCase}
                      clientUnitId={client?.unitId}
                    />
                  </div>
                ) : null}
              </div>
            </FormSection>
          ) : null}

          {isCreate ? (
            <FormSection
              step={2}
              title="Advocate"
              description="Whose diary to book"
            >
              {renderAdvocateSelect("Advocate")}
            </FormSection>
          ) : null}

          {isEditOnly ? (
            <FormSection
              title="Details"
              description="Use Reschedule to change advocate or date/time"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ClientPicker
                  value={client}
                  onChange={setClient}
                  label="Client"
                />
                <div className="grid gap-2">
                  <Label>Title / purpose</Label>
                  <SelectOrOther
                    value={title}
                    onChange={setTitle}
                    options={APPOINTMENT_TITLE_OPTIONS}
                    placeholder="Select title"
                    className="h-11"
                    otherPlaceholder="Custom title"
                  />
                </div>
                <div className="md:col-span-2">
                  <CasePicker
                    value={linkedCase}
                    onChange={setLinkedCase}
                    clientUnitId={client?.unitId}
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Mode</Label>
                  <ModePicker
                    value={mode}
                    onChange={setMode}
                    options={modeOptions}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Select value={durationMin} onValueChange={setDurationMin}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent className="z-200">
                      {APPOINTMENT_DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="apt-notes-edit">Notes</Label>
                  <Textarea
                    id="apt-notes-edit"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Internal notes…"
                  />
                </div>
              </div>
              {appointment ? (
                <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  Current slot:{" "}
                  <span className="font-medium text-navy">
                    {formatWhen(appointment.scheduledAt)}
                  </span>
                  {appointment.advocateName
                    ? ` · ${appointment.advocateName}`
                    : ""}
                  . Change via Reschedule.
                </p>
              ) : null}
            </FormSection>
          ) : null}

          {(isCreate || isReschedule) && (
            <FormSection
              step={isCreate ? 3 : 2}
              title="When & how"
              description="Mode, length, and a free slot"
            >
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Mode</Label>
                  <ModePicker
                    value={mode}
                    onChange={setMode}
                    options={modeOptions}
                  />
                </div>
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Duration</Label>
                  <Select
                    value={durationMin}
                    onValueChange={(v) => {
                      setDurationMin(v);
                      setScheduledAt("");
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent className="z-200">
                      {APPOINTMENT_DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>
                    {isReschedule ? "New date & time" : "Date & time"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <AvailabilitySlotPicker
                    key={`${open}-${appointment?.unitId ?? "new"}-${effectiveAdvocateMobile}-${formMode}`}
                    advocateMobile={effectiveAdvocateMobile}
                    durationMin={Number(durationMin) || 30}
                    clientUnitId={client?.unitId}
                    excludeAppointmentUnitId={
                      isReschedule ? appointment?.unitId : undefined
                    }
                    value={scheduledAt}
                    onChange={setScheduledAt}
                  />
                </div>
              </div>
            </FormSection>
          )}

          {isReschedule ? (
            <FormSection
              step={3}
              title="Details"
              description="Kept from the original booking — edit if needed"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ClientPicker
                  value={client}
                  onChange={(c) => {
                    setClient(c);
                    setScheduledAt("");
                  }}
                  label="Client"
                />
                <div className="grid gap-2">
                  <Label>Title / purpose</Label>
                  <SelectOrOther
                    value={title}
                    onChange={setTitle}
                    options={APPOINTMENT_TITLE_OPTIONS}
                    placeholder="Select title"
                    className="h-11"
                    otherPlaceholder="Custom title"
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="apt-notes-rs">Notes</Label>
                  <Textarea
                    id="apt-notes-rs"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Reason for reschedule / handoff…"
                  />
                </div>
              </div>
            </FormSection>
          ) : null}

          {isCreate ? (
            <FormSection step={4} title="Notes">
              <div className="grid gap-2">
                <Label htmlFor="apt-notes">Notes</Label>
                <Textarea
                  id="apt-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    clientPortal
                      ? "Anything the office should know…"
                      : "Call-in notes, papers to bring…"
                  }
                />
              </div>
            </FormSection>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/15">
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="gap-2 bg-card sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {isReschedule
              ? "Old slot opens for others after you move."
              : isCreate
                ? "Only free slots are shown."
                : "Time changes → Reschedule."}
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:min-w-40 sm:w-auto"
              onClick={handleSubmit}
              disabled={busy}
            >
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
