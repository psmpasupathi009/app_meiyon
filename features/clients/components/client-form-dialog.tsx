"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { ClientSummary } from "@/features/clients/server/serialize";
import {
  CLIENT_GENDER_OPTIONS,
  CLIENT_INTAKE_DEFAULTS,
} from "@/lib/validations/clients.schema";
import { office } from "@/config/company/office";
import {
  OCCUPATION_OPTIONS,
  REFERRED_BY_OPTIONS,
  RELATION_PREFIX_OPTIONS,
} from "@/config/company/form-options";
import { SelectOrOther } from "@/shared/components/forms/select-or-other";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import { LocationCascade } from "@/shared/components/pickers/location-cascade";
import { cn } from "@/lib/utils/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientSummary | null;
  onSaved: (client: ClientSummary) => void;
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
        "min-w-0 space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-4",
        className
      )}
    >
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

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: Props) {
  const isEdit = Boolean(client);
  const [name, setName] = useState("");
  const [relationPrefix, setRelationPrefix] = useState("");
  const [relationName, setRelationName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [gender, setGender] = useState("");
  const [mobile, setMobile] = useState("");
  const [altMobile, setAltMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState(CLIENT_INTAKE_DEFAULTS.district);
  const [state, setState] = useState(CLIENT_INTAKE_DEFAULTS.state);
  const [referredBy, setReferredBy] = useState("");
  const [matterBrief, setMatterBrief] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onLocationChange = useCallback(
    (next: { state: string; district: string; city: string }) => {
      setState(next.state);
      setDistrict(next.district);
      setCity(next.city);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName(client?.name ?? "");
      const fos = client?.fatherOrSpouse ?? "";
      const prefixHit = RELATION_PREFIX_OPTIONS.find((p) =>
        fos.startsWith(`${p.value} `)
      );
      if (prefixHit) {
        setRelationPrefix(prefixHit.value);
        setRelationName(fos.slice(prefixHit.value.length).trim());
      } else {
        setRelationPrefix("");
        setRelationName(fos);
      }
      setOccupation(client?.occupation ?? "");
      setGender(client?.gender ?? "");
      setMobile(client?.mobile ?? "");
      setAltMobile(client?.altMobile ?? "");
      setEmail(client?.email ?? "");
      setAddress(client?.address ?? "");
      setCity(client?.city ?? "");
      setDistrict(client?.district ?? CLIENT_INTAKE_DEFAULTS.district);
      setState(client?.state ?? CLIENT_INTAKE_DEFAULTS.state);
      setReferredBy(client?.referredBy ?? "");
      setMatterBrief(client?.matterBrief ?? "");
      setNotes(client?.notes ?? "");
      setSmsConsent(client?.smsConsent ?? true);
      setError("");
    });
  }, [open, client]);

  async function handleSubmit() {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (mobile.replace(/\D/g, "").length < 10) {
      setError("Enter a valid mobile number");
      return;
    }

    const fatherOrSpouse = [relationPrefix, relationName.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    setBusy(true);
    const payload = {
      name,
      fatherOrSpouse: fatherOrSpouse || undefined,
      occupation: occupation || undefined,
      gender: gender || undefined,
      mobile,
      altMobile: altMobile || undefined,
      email: email || undefined,
      address: address || undefined,
      city: city || undefined,
      district: district || undefined,
      state: state || undefined,
      referredBy: referredBy || undefined,
      matterBrief: matterBrief || undefined,
      notes: notes || undefined,
      smsConsent,
    };

    const { ok, data } = await apiFetch<{ client: ClientSummary }>(
      isEdit ? `/api/clients/${client!.unitId}` : "/api/clients",
      { method: isEdit ? "PATCH" : "POST", json: payload }
    );
    setBusy(false);

    if (!ok) {
      setError(
        getErrorMessage(data as Record<string, unknown>, "Failed to save client")
      );
      return;
    }

    toast.success(isEdit ? "Client updated" : "Client intake saved");
    onSaved((data as unknown as { client: ClientSummary }).client);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* z-70: nested from ClientPicker inside other dialogs */}
      <DialogContent
        size="lg"
        className="z-70 p-0"
        overlayClassName="z-70"
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit client intake" : "Client intake"}
          </DialogTitle>
          <DialogDescription>
            Collect identity and contact for the office register. Pick state and
            district; type town / city freely. Defaults: {office.defaultDistrict},{" "}
            {office.defaultState}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <Section
                title="1. Identity"
                description="As on petition / vakalat — name and parent or spouse"
              >
                <div className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="grid min-w-0 gap-2 md:col-span-2">
                    <Label htmlFor="cl-name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cl-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="As in petition / ID"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label>Relation</Label>
                    <SearchableSelect
                      value={relationPrefix}
                      onChange={setRelationPrefix}
                      options={RELATION_PREFIX_OPTIONS}
                      placeholder="S/o · W/o…"
                      searchPlaceholder="Search relation…"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="cl-father">
                      Father / spouse / guardian name
                    </Label>
                    <Input
                      id="cl-father"
                      value={relationName}
                      onChange={(e) => setRelationName(e.target.value)}
                      placeholder="Name"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label>Gender</Label>
                    <SearchableSelect
                      value={gender}
                      onChange={setGender}
                      options={[...CLIENT_GENDER_OPTIONS]}
                      placeholder="Optional"
                      searchPlaceholder="Search…"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label>Occupation</Label>
                    <SelectOrOther
                      value={occupation}
                      onChange={setOccupation}
                      options={OCCUPATION_OPTIONS}
                      placeholder="Select occupation"
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="2. Contact"
                description="Primary mobile is used for hearing SMS"
              >
                <div className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="cl-mobile">
                      Mobile <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cl-mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="cl-alt-mobile">Alt mobile</Label>
                    <Input
                      id="cl-alt-mobile"
                      value={altMobile}
                      onChange={(e) => setAltMobile(e.target.value)}
                    />
                  </div>
                  <div className="grid min-w-0 gap-2 md:col-span-2">
                    <Label htmlFor="cl-email">Email</Label>
                    <Input
                      id="cl-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={smsConsent}
                      onChange={(e) => setSmsConsent(e.target.checked)}
                    />
                    <span>
                      Client consents to hearing / office SMS on the primary
                      mobile (see Privacy policy).
                    </span>
                  </label>
                </div>
              </Section>
            </div>

            <div className="space-y-4">
              <Section
                title="3. Address"
                description="For notices and vakalat — select state and district; type town / city"
              >
                <div className="grid min-w-0 gap-4">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="cl-address">Door / street / area</Label>
                    <Textarea
                      id="cl-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      placeholder="Door no., street, village / locality"
                    />
                  </div>
                  <LocationCascade
                    key={`${open}-${client?.unitId ?? "new"}`}
                    state={state}
                    district={district}
                    city={city}
                    onChange={onLocationChange}
                  />
                </div>
              </Section>

              <Section
                title="4. Matter at intake"
                description="Short facts before case register — opposite party goes on the case form"
              >
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                  <div className="grid min-w-0 gap-2 md:col-span-2">
                    <Label htmlFor="cl-matter">Matter brief</Label>
                    <Textarea
                      id="cl-matter"
                      value={matterBrief}
                      onChange={(e) => setMatterBrief(e.target.value)}
                      rows={3}
                      placeholder="What happened, relief sought, urgency, papers brought…"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label>Referred by</Label>
                    <SelectOrOther
                      value={referredBy}
                      onChange={setReferredBy}
                      options={REFERRED_BY_OPTIONS}
                      placeholder="How they found us"
                      otherPlaceholder="Name / source"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="cl-notes">Internal notes</Label>
                    <Textarea
                      id="cl-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Clerk notes — not for SMS"
                    />
                  </div>
                </div>
              </Section>
            </div>

            {error ? (
              <p className="text-sm text-destructive lg:col-span-2">{error}</p>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter className="bg-muted/30 sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Required: name and mobile
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
              {busy ? "Saving…" : isEdit ? "Save changes" : "Save client (CLI)"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
