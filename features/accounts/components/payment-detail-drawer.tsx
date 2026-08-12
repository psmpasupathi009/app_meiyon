"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiDownload, apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PaymentSummary } from "@/features/accounts/server/serialize";
import type { DocumentSummary } from "@/features/documents/server/serialize";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { Label } from "@/components/ui/label";
import { istDateKey, istDisplayDate } from "@/lib/utils/ist";

type ActivityItem = {
  action: string;
  actorUnitId: string | null;
  meta: unknown;
  createdAt: string;
};

type DetailResponse = {
  payment: PaymentSummary & { clientName: string | null };
  activity: ActivityItem[];
  receipts: DocumentSummary[];
};

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "muted"
> = {
  pending: "warning",
  paid: "success",
  void: "muted",
};

const ACTION_LABEL: Record<string, string> = {
  "payment.create": "Created",
  "payment.update": "Updated",
  "payment.void": "Voided",
  "payment.import": "Imported",
};

function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return istDisplayDate(new Date(iso));
}

function actorLabel(
  actor: { unitId: string; name: string | null } | null | undefined
) {
  if (!actor) return "—";
  return actor.name ? `${actor.name} (${actor.unitId})` : actor.unitId;
}

export function PaymentDetailDrawer({
  open,
  onOpenChange,
  unitId,
  canEdit,
  canUploadReceipt,
  onEdit,
  onVoid,
  onFilterClient,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
  canEdit: boolean;
  canUploadReceipt: boolean;
  onEdit: (payment: PaymentSummary & { clientName: string | null }) => void;
  onVoid: (unitId: string) => void;
  onFilterClient?: (clientUnitId: string | null) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidOn, setMarkPaidOn] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { ok, data } = await apiFetch<DetailResponse>(
      `/api/accounts/${unitId}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load entry")
      );
      return;
    }
    setDetail(data as unknown as DetailResponse);
  }, [unitId]);

  useEffect(() => {
    if (!open || !unitId) {
      setDetail(null);
      setMarkPaidOpen(false);
      return;
    }
    void load();
  }, [open, unitId, load]);

  const payment = detail?.payment;

  function openMarkPaid() {
    setMarkPaidOn(istDateKey(new Date()));
    setMarkPaidOpen(true);
  }

  async function confirmMarkPaid() {
    if (!payment || !markPaidOn) return;
    setMarkingPaid(true);
    const { ok, data } = await apiFetch(`/api/accounts/${payment.unitId}`, {
      method: "PATCH",
      json: { status: "paid", paidOn: markPaidOn },
    });
    setMarkingPaid(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to mark paid")
      );
      return;
    }
    toast.success("Marked as paid");
    setMarkPaidOpen(false);
    onChanged();
    void load();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          size="detail"
          showClose
        >
          <SheetHeader>
            <SheetTitle className="pr-8">
              {payment ? (
                <span className="inline-flex items-center gap-2">
                  <UnitIdBadge value={payment.unitId} />
                  <Badge variant={STATUS_VARIANT[payment.status] ?? "outline"}>
                    {payment.status}
                  </Badge>
                </span>
              ) : (
                "Cash entry"
              )}
            </SheetTitle>
            <SheetDescription>
              Audit detail — who recorded it, void reason, receipts, and history.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {loading && !detail ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : payment ? (
              <div className="grid gap-6">
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Client
                    </dt>
                    <dd className="mt-1 text-navy">
                      {onFilterClient ? (
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline"
                          onClick={() => onFilterClient(payment.clientUnitId)}
                        >
                          {payment.clientName ?? payment.clientUnitId}
                        </button>
                      ) : (
                        <Link
                          href={`/accounts?clientUnitId=${payment.clientUnitId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {payment.clientName ?? payment.clientUnitId}
                        </Link>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Case
                    </dt>
                    <dd className="mt-1 text-navy">
                      {payment.caseUnitId ? (
                        <Link
                          href={`/cases/${payment.caseUnitId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {payment.caseUnitId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Purpose
                      </dt>
                      <dd className="mt-1 capitalize text-navy">
                        {payment.typeLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Amount
                      </dt>
                      <dd className="mt-1 font-semibold text-navy">
                        {rupee(payment.amount)}
                      </dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Paid on
                      </dt>
                      <dd className="mt-1">{formatWhen(payment.paidOn)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Recorded
                      </dt>
                      <dd className="mt-1">{formatWhen(payment.createdAt)}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-navy">
                      {payment.notes?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Created by
                    </dt>
                    <dd className="mt-1">{actorLabel(payment.createdBy)}</dd>
                  </div>
                  {payment.status === "void" ? (
                    <>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Voided
                        </dt>
                        <dd className="mt-1">
                          {formatWhen(payment.voidedAt)} ·{" "}
                          {actorLabel(payment.voidedBy)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Void reason
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap text-navy">
                          {payment.voidReason ?? "—"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                {canEdit && payment.status !== "void" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(payment)}
                    >
                      Edit
                    </Button>
                    {payment.status === "pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={openMarkPaid}
                      >
                        Mark paid
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onVoid(payment.unitId)}
                    >
                      Void
                    </Button>
                  </div>
                ) : null}

                {markPaidOpen ? (
                  <div className="grid gap-3 rounded-xl border border-border/80 p-4">
                    <div>
                      <p className="text-sm font-medium text-navy">Mark as paid</p>
                      <p className="text-xs text-muted-foreground">
                        Confirm the paid-on date for the cash register.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Paid on</Label>
                      <DatePicker value={markPaidOn} onChange={setMarkPaidOn} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={markingPaid || !markPaidOn}
                        onClick={() => void confirmMarkPaid()}
                      >
                        {markingPaid ? "Saving…" : "Confirm paid"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMarkPaidOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-navy">Receipts</h3>
                    {canUploadReceipt ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadOpen(true)}
                      >
                        Upload receipt
                      </Button>
                    ) : null}
                  </div>
                  {(detail?.receipts.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No receipt files linked to this client/case yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail!.receipts.map((r) => (
                        <li
                          key={r.unitId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/80 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-navy">
                            {r.title}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-xs font-medium text-navy underline-offset-2 hover:underline"
                            onClick={async () => {
                              const result = await apiDownload(
                                `/api/documents/${r.unitId}/download`,
                                r.originalName || r.title || "receipt"
                              );
                              if (!result.ok) {
                                toast.error(result.error ?? "Download failed");
                              }
                            }}
                          >
                            Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-navy">
                    Activity
                  </h3>
                  {(detail?.activity.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No audit events yet.
                    </p>
                  ) : (
                    <ol className="space-y-3 border-l border-border/80 pl-4">
                      {detail!.activity.map((a, i) => (
                        <li key={`${a.createdAt}-${i}`} className="relative text-sm">
                          <span className="absolute top-1.5 left-[-1.15rem] size-2 rounded-full bg-navy/70" />
                          <p className="font-medium text-navy">
                            {ACTION_LABEL[a.action] ?? a.action}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatWhen(a.createdAt)}
                            {a.actorUnitId ? ` · ${a.actorUnitId}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Entry not found.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {payment ? (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          caseUnitId={payment.caseUnitId ?? undefined}
          clientUnitId={payment.clientUnitId}
          defaultDocType="receipt"
          onUploaded={() => {
            void load();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
