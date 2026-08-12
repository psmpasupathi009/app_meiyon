"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import {
  DESIGNATION_GROUPS,
  designationDefaultRoles,
  normalizeDesignation,
  type Designation,
} from "@meiyon/config";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import { CourtCascade } from "@/shared/components/pickers/court-cascade";
import type { DefaultCourt } from "@/lib/hearings/court-key";

const DESIGNATION_OPTIONS = DESIGNATION_GROUPS.flatMap((g) =>
  g.items.map((d) => ({ value: d, label: d, group: g.label }))
);
import {
  ACTION_LABELS,
  MODULE_LABELS,
  ROLE_BLURBS,
  ROLE_LABELS,
  actionLabel,
  moduleLabel,
} from "@meiyon/config";
import type { EmployeeSummary } from "@/features/employees/server/serialize";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils/cn";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[])
  .filter((value) => value !== "client")
  .map((value) => ({
    value,
    label: ROLE_LABELS[value],
    blurb: ROLE_BLURBS[value],
  }));

type PreviewResponse = {
  roles: string[];
  permissions: string[];
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-4">
      <div>
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function rolesEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function groupPermissions(permissions: string[]) {
  const byModule = new Map<string, string[]>();
  for (const key of permissions) {
    const [mod, action] = key.split(".");
    if (!mod || !action) continue;
    const list = byModule.get(mod) ?? [];
    list.push(action);
    byModule.set(mod, list);
  }
  const order = Object.keys(MODULE_LABELS);
  return [...byModule.entries()].sort(([a], [b]) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeSummary | null;
  canAssignAdmin: boolean;
  onSaved: () => void;
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  canAssignAdmin,
  onSaved,
}: Props) {
  const isEdit = Boolean(employee);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [designation, setDesignation] = useState<string>("");
  const [roles, setRoles] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [defaultCourts, setDefaultCourts] = useState<DefaultCourt[]>([]);
  const [draftCourt, setDraftCourt] = useState<DefaultCourt>({
    state: "Tamil Nadu",
    district: "",
    city: "",
    courtName: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewKeys, setPreviewKeys] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const debouncedRoles = useDebouncedValue(roles, 250);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      await Promise.resolve();
      setName(employee?.name ?? "");
      setMobile(employee?.mobile ?? "");
      setDesignation(normalizeDesignation(employee?.designation) ?? employee?.designation ?? "");
      setRoles(employee?.roles ?? []);
      setEmail(employee?.email ?? "");
      setAddress(employee?.address ?? "");
      setDefaultCourts(employee?.defaultCourts ?? []);
      setDraftCourt({
        state: "Tamil Nadu",
        district: "",
        city: "",
        courtName: "",
      });
      setError("");
      setPreviewKeys([]);
      setPreviewError("");
    })();
  }, [open, employee]);

  useEffect(() => {
    if (!open) return;
    if (debouncedRoles.length === 0) return;

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPreviewLoading(true);
      setPreviewError("");
      const { ok, data } = await apiFetch<PreviewResponse>("/api/permissions/preview", {
        method: "POST",
        json: { roles: debouncedRoles },
      });
      if (cancelled) return;
      setPreviewLoading(false);
      if (!ok) {
        setPreviewKeys([]);
        setPreviewError(
          getErrorMessage(data as Record<string, unknown>, "Could not load access preview")
        );
        return;
      }
      const body = data as unknown as PreviewResponse;
      setPreviewKeys(Array.isArray(body.permissions) ? body.permissions : []);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, debouncedRoles]);

  const previewGroups = useMemo(() => {
    if (debouncedRoles.length === 0) return [];
    return groupPermissions(previewKeys);
  }, [debouncedRoles.length, previewKeys]);

  const activePreviewLoading = debouncedRoles.length > 0 && previewLoading;
  const activePreviewError = debouncedRoles.length > 0 ? previewError : "";

  const suggestedRoles =
    !isEdit && designation && designation in designationDefaultRoles
      ? designationDefaultRoles[designation as Designation]
      : null;
  const suggestedRolesLabel = suggestedRoles
    ?.map((role) => ROLE_LABELS[role] ?? role)
    .join(", ");
  const changedFromSuggestion =
    Boolean(suggestedRoles) && !rolesEqual(roles, suggestedRoles ?? []);

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function applyDesignationDefaults(value: string) {
    setDesignation(value);
    if (!isEdit && value && value in designationDefaultRoles) {
      setRoles(designationDefaultRoles[value as Designation]);
    }
  }

  async function handleSubmit() {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!isEdit && mobile.replace(/\D/g, "").length < 10) {
      setError("Enter a valid mobile number");
      return;
    }
    if (!designation) {
      setError("Select a designation");
      return;
    }
    if (roles.length === 0) {
      setError("Select at least one role");
      return;
    }
    if (roles.includes("advocate") && defaultCourts.length === 0) {
      setError(
        isEdit
          ? "Advocates need at least one default court"
          : "Add at least one default court for advocates"
      );
      return;
    }

    setBusy(true);
    const payload = {
      name,
      designation,
      roles,
      email: email || undefined,
      address: address || undefined,
      defaultCourts,
      ...(isEdit ? {} : { mobile }),
    };

    const { ok, data } = await apiFetch(
      isEdit ? `/api/employees/${employee!.unitId}` : "/api/employees",
      { method: isEdit ? "PATCH" : "POST", json: payload }
    );
    setBusy(false);

    if (!ok) {
      setError(getErrorMessage(data as Record<string, unknown>, "Failed to save employee"));
      return;
    }

    toast.success(isEdit ? "Employee updated" : "Employee created");
    onSaved();
    onOpenChange(false);
  }

  const visibleRoles = ROLE_OPTIONS.filter((r) => r.value !== "admin" || canAssignAdmin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0">
        <DialogHeader className="shrink-0 border-b border-border/80 px-3 py-3 pr-11 sm:px-5 sm:py-4 md:px-6">
          <DialogTitle>
            {isEdit ? "Edit employee" : "Add employee"}
          </DialogTitle>
          <DialogDescription>
            Designation is the job title. Roles control what they can do in the app.
            {isEdit && employee ? ` Updating ${employee.unitId}.` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5">
          {isEdit && employee ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs sm:text-sm">
              <UnitIdBadge value={employee.unitId} />
              <Badge variant={employee.isActive ? "success" : "muted"}>
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant={employee.hasPin ? "outline" : "warning"}>
                {employee.hasPin ? "PIN set" : "Setup needed"}
              </Badge>
              <span className="text-muted-foreground">
                Last login: {formatLastLogin(employee.lastLoginAt)}
              </span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <Section
                title="1. Identity"
                description="Login and contact details for this person"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="emp-name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emp-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="As on visiting card"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emp-mobile">
                      Mobile <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emp-mobile"
                      value={mobile}
                      disabled={isEdit}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isEdit ? "Login mobile cannot be changed here." : "Stored as +91… for login."}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emp-email">Email</Label>
                    <Input
                      id="emp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="emp-address">Address</Label>
                    <Textarea
                      id="emp-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Optional — home or office address"
                      rows={3}
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="2. Job title"
                description="Visiting-card designation — not the same as app access"
              >
                <div className="grid gap-2">
                  <Label>
                    Designation <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    value={designation}
                    onChange={applyDesignationDefaults}
                    options={
                      designation &&
                      !DESIGNATION_OPTIONS.some((o) => o.value === designation)
                        ? [
                            {
                              value: designation,
                              label: designation,
                              group: "Current",
                            },
                            ...DESIGNATION_OPTIONS,
                          ]
                        : DESIGNATION_OPTIONS
                    }
                    grouped
                    placeholder="Select designation"
                    searchPlaceholder="Search designation…"
                  />
                  <p className="text-xs text-muted-foreground">
                    On create, this prefills roles on the right. Changing it later does not overwrite
                    roles.
                  </p>
                </div>
              </Section>

              <Section
                title="3. Default courts"
                description={
                  roles.includes("advocate")
                    ? "Required for advocates. First court is primary for new case prefills."
                    : "First court is primary for new case prefills. Optional for non-advocates."
                }
              >
                {roles.includes("advocate") && defaultCourts.length === 0 ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Add at least one court this advocate usually appears in.
                  </p>
                ) : null}
                {defaultCourts.length === 0 && !roles.includes("advocate") ? (
                  <p className="text-sm text-muted-foreground">
                    No default courts yet. Add courts if this person follows any.
                  </p>
                ) : null}
                {defaultCourts.length > 0 ? (
                  <ul className="space-y-2">
                    {defaultCourts.map((c, idx) => (
                      <li
                        key={`${c.courtName}-${idx}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1">
                          {idx === 0 ? (
                            <Badge variant="outline" className="mr-2">
                              Primary
                            </Badge>
                          ) : null}
                          {c.courtName}
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.city}, {c.district}, {c.state}
                          </span>
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === 0}
                            onClick={() =>
                              setDefaultCourts((prev) => {
                                const next = [...prev];
                                const tmp = next[idx - 1]!;
                                next[idx - 1] = next[idx]!;
                                next[idx] = tmp;
                                return next;
                              })
                            }
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === defaultCourts.length - 1}
                            onClick={() =>
                              setDefaultCourts((prev) => {
                                const next = [...prev];
                                const tmp = next[idx + 1]!;
                                next[idx + 1] = next[idx]!;
                                next[idx] = tmp;
                                return next;
                              })
                            }
                          >
                            Down
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDefaultCourts((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <CourtCascade
                    state={draftCourt.state}
                    district={draftCourt.district}
                    city={draftCourt.city}
                    courtName={draftCourt.courtName}
                    onChange={(next) => setDraftCourt(next)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      !draftCourt.state.trim() ||
                      !draftCourt.district.trim() ||
                      !draftCourt.city.trim() ||
                      !draftCourt.courtName.trim()
                    }
                    onClick={() => {
                      setDefaultCourts((prev) => [...prev, { ...draftCourt }]);
                      setDraftCourt({
                        state: draftCourt.state || "Tamil Nadu",
                        district: "",
                        city: "",
                        courtName: "",
                      });
                    }}
                  >
                    Add court
                  </Button>
                </div>
              </Section>
            </div>

            <div className="space-y-4">
              <Section
                title="4. App access"
                description="Roles grant permissions. A person can hold more than one."
              >
                <div className="grid gap-2">
                  {visibleRoles.map((r) => {
                    const selected = roles.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleRole(r.value)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "border-navy bg-secondary shadow-sm"
                            : "border-border/80 bg-card hover:border-navy/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-navy">{r.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{r.blurb}</p>
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 size-4 shrink-0 rounded-sm border",
                              selected ? "border-brand bg-brand" : "border-border bg-card"
                            )}
                            aria-hidden
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {suggestedRolesLabel ? (
                  <p className="text-xs text-muted-foreground">
                    Suggested from designation: {suggestedRolesLabel}
                  </p>
                ) : null}
                {changedFromSuggestion ? (
                  <p className="text-xs text-muted-foreground">
                    You changed the suggested access — that is fine.
                  </p>
                ) : null}
              </Section>

              <Section
                title="5. What they can access"
                description="Live preview from the office permissions matrix"
              >
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select at least one role.</p>
                ) : activePreviewLoading ? (
                  <p className="text-sm text-muted-foreground">Loading access…</p>
                ) : activePreviewError ? (
                  <p className="text-sm text-destructive">{activePreviewError}</p>
                ) : previewGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No permissions for this combination.</p>
                ) : (
                  <div className="space-y-3">
                    {roles.includes("advocate") ? (
                      <p className="rounded-lg border border-navy/15 bg-card px-3 py-2 text-xs text-navy">
                        Will appear in advocate lists for cases and appointments.
                      </p>
                    ) : null}
                    {previewGroups.map(([mod, actions]) => (
                      <div key={mod}>
                        <p className="text-xs font-semibold text-navy">
                          {moduleLabel(mod)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {actions.map((action) => (
                            <Badge
                              key={`${mod}.${action}`}
                              variant="outline"
                              className="font-normal normal-case"
                            >
                              {ACTION_LABELS[action] ?? actionLabel(action)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/80 px-3 py-3 sm:px-5 md:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
