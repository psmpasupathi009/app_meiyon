"use client";

import { useEffect, useState } from "react";
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
import { ClientPicker } from "@/features/clients/components/client-picker";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import {
  PAYMENT_PURPOSE_OPTIONS,
  PAYMENT_PURPOSE_LABELS,
  type PaymentPurpose,
} from "@/features/accounts/lib/payment-purposes";
import type { PaymentSummary } from "@/features/accounts/server/serialize";
import { istDateKey } from "@/lib/utils/ist";

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
];

export function PaymentFormDialog({
  open,
  onOpenChange,
  defaultClientUnitId,
  defaultCaseUnitId,
  payment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientUnitId?: string | null;
  defaultCaseUnitId?: string | null;
  /** When set, dialog edits via PATCH. */
  payment?: (PaymentSummary & { clientName?: string | null }) | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(payment);
  const [client, setClient] = useState<{ unitId: string; name: string } | null>(
    null
  );
  const [caseUnitId, setCaseUnitId] = useState("");
  const [type, setType] = useState("advance");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("pending");
  const [paidOn, setPaidOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      await Promise.resolve();
      if (payment) {
        if (payment.status === "void") {
          onOpenChange(false);
          return;
        }
        setClient({
          unitId: payment.clientUnitId,
          name: payment.clientName ?? payment.clientUnitId,
        });
        setCaseUnitId(payment.caseUnitId ?? "");
        setType(payment.type);
        setAmount(String(payment.amount));
        setStatus(payment.status);
        setPaidOn(
          payment.status === "paid" && payment.paidOn
            ? istDateKey(new Date(payment.paidOn))
            : ""
        );
        setNotes(payment.notes ?? "");
      } else {
        setClient(
          defaultClientUnitId
            ? { unitId: defaultClientUnitId, name: defaultClientUnitId }
            : null
        );
        setCaseUnitId(defaultCaseUnitId ?? "");
        setType("advance");
        setAmount("");
        setStatus("pending");
        setPaidOn("");
        setNotes("");
      }
      setError("");
    })();
  }, [open, defaultClientUnitId, defaultCaseUnitId, payment, onOpenChange]);

  const purposeOptions = (() => {
    if (PAYMENT_PURPOSE_OPTIONS.some((o) => o.value === type)) {
      return PAYMENT_PURPOSE_OPTIONS;
    }
    return [
      ...PAYMENT_PURPOSE_OPTIONS,
      {
        value: type,
        label:
          PAYMENT_PURPOSE_LABELS[type as PaymentPurpose] ??
          type.replaceAll("_", " "),
      },
    ];
  })();

  async function handleSubmit() {
    setError("");
    if (!isEdit && !client) {
      setError("Select a client");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (type === "other" && !notes.trim()) {
      setError("Notes are required for Other purpose");
      return;
    }
    if (status === "paid" && !paidOn) {
      setError("Paid on date is required when status is paid");
      return;
    }

    const paidOnPayload = status === "paid" ? paidOn : null;
    const notesPayload = notes.trim() === "" ? "" : notes;

    setBusy(true);
    if (isEdit && payment) {
      const { ok, data } = await apiFetch(`/api/accounts/${payment.unitId}`, {
        method: "PATCH",
        json: {
          type,
          amount: amt,
          status,
          paidOn: paidOnPayload,
          notes: notesPayload,
        },
      });
      setBusy(false);
      if (!ok) {
        setError(
          getErrorMessage(data as Record<string, unknown>, "Failed to update entry")
        );
        return;
      }
      toast.success("Cash entry updated");
    } else {
      const { ok, data } = await apiFetch("/api/accounts", {
        method: "POST",
        json: {
          clientUnitId: client!.unitId,
          caseUnitId: caseUnitId || undefined,
          type,
          amount: amt,
          status,
          paidOn: paidOnPayload,
          notes: notesPayload || undefined,
        },
      });
      setBusy(false);
      if (!ok) {
        setError(
          getErrorMessage(data as Record<string, unknown>, "Failed to save entry")
        );
        return;
      }
      toast.success("Cash entry recorded");
    }
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" overlayClassName="z-[60]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit cash entry" : "Record cash entry"}
          </DialogTitle>
          <DialogDescription>
            Office cash register — fees, advances, and actuals (court fee, stamp,
            travel, etc.).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid min-w-0 gap-4">
          {!isEdit ? (
            <ClientPicker value={client} onChange={setClient} />
          ) : (
            <div className="grid min-w-0 gap-1">
              <Label>Client</Label>
              <p className="text-sm text-navy">
                {client?.name ?? payment?.clientUnitId}
              </p>
            </div>
          )}

          {isEdit ? (
            <div className="grid min-w-0 gap-1">
              <Label>Case</Label>
              <p className="text-sm text-navy">{caseUnitId || "—"}</p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="pay-case">Case ID (optional)</Label>
              <Input
                id="pay-case"
                value={caseUnitId}
                onChange={(e) => setCaseUnitId(e.target.value)}
                placeholder="CSE-00001"
              />
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label>Purpose</Label>
              <SearchableSelect
                value={type}
                onChange={setType}
                options={purposeOptions}
                placeholder="Purpose"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid min-w-0 gap-2">
            <Label>Status</Label>
            <SearchableSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                if (v === "pending") setPaidOn("");
                if (v === "paid" && !paidOn) setPaidOn(istDateKey(new Date()));
              }}
              options={PAYMENT_STATUS_OPTIONS}
              placeholder="Status"
            />
          </div>

          {status === "paid" ? (
            <div className="grid min-w-0 gap-2">
              <Label>Paid on</Label>
              <DatePicker value={paidOn} onChange={setPaidOn} />
            </div>
          ) : null}

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="pay-notes">
              Notes{type === "other" ? " (required)" : ""}
            </Label>
            <Textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. consultation adjusted against advance"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
