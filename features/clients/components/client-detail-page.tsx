"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import type { ClientSummary } from "@/features/clients/server/serialize";
import type { DocumentSummary } from "@/features/documents/server/serialize";
import type { PaymentSummary } from "@/features/accounts/server/serialize";
import type { FeeRollup } from "@/features/accounts/server/fee-rollup";
import { ClientFormDialog } from "@/features/clients/components/client-form-dialog";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import { CaseDocumentsPanel } from "@/features/documents/components/case-documents-panel";
import type { DocumentTypeValue } from "@/lib/validations/documents.schema";
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_VARIANT,
  normalizeCaseStatus,
} from "@meiyon/config";

type ClientCaseRow = {
  unitId: string;
  caseNumber: string | null;
  courtName: string | null;
  status: string;
  nextHearingAt: string | null;
  agreedFee: number | null;
};

type DetailResponse = {
  client: ClientSummary;
  cases: ClientCaseRow[];
  payments: PaymentSummary[];
  documents: DocumentSummary[];
  fee: FeeRollup | null;
  portal?: {
    invited: boolean;
    isActive: boolean;
    userUnitId: string | null;
    hasPin: boolean;
    lastLoginAt: string | null;
  };
};

function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ClientDetailPage({
  user,
  unitId,
}: {
  user: PublicUser;
  unitId: string;
}) {
  const can = (module: string, action: string) =>
    user.permissions.includes(`${module}.${action}`);

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentTypeValue>("other");
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch<DetailResponse>(
      `/api/clients/${unitId}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load client")
      );
      return;
    }
    setDetail(data as unknown as DetailResponse);
  }, [unitId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        title="Client not found"
        description="It may have been removed."
        action={
          <Button asChild variant="outline">
            <Link href="/clients">Back to clients</Link>
          </Button>
        }
      />
    );
  }

  const { client, cases, payments, documents, fee } = detail;
  const location = [client.city, client.district, client.state]
    .filter(Boolean)
    .join(", ");

  function openUpload(docType: DocumentTypeValue = "other") {
    setUploadType(docType);
    setUploadOpen(true);
  }

  async function invitePortal() {
    setPortalBusy(true);
    const { ok, data } = await apiFetch<{
      message?: string;
      portal?: DetailResponse["portal"];
    }>(`/api/clients/${unitId}/portal-access`, { method: "POST" });
    setPortalBusy(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Could not invite to portal"
        )
      );
      return;
    }
    toast.success(
      (data as { message?: string })?.message ?? "Portal access invited"
    );
    void load();
  }

  async function revokePortal() {
    if (
      !window.confirm(
        "Revoke this client’s portal login? They will not be able to sign in."
      )
    ) {
      return;
    }
    setPortalBusy(true);
    const { ok, data } = await apiFetch<{ message?: string }>(
      `/api/clients/${unitId}/portal-access`,
      { method: "DELETE" }
    );
    setPortalBusy(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Could not revoke portal access"
        )
      );
      return;
    }
    toast.success(
      (data as { message?: string })?.message ?? "Portal access revoked"
    );
    void load();
  }

  const portal = detail.portal;
  const portalActive = Boolean(portal?.invited && portal.isActive);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild type="button" variant="ghost" size="sm" className="-ml-2">
          <Link href="/clients">
            <ArrowLeft className="size-4" />
            Clients
          </Link>
        </Button>
      </div>

      <PageHeader
        title={client.name}
        description={`+91 ${client.mobile}${client.altMobile ? ` · alt +91 ${client.altMobile}` : ""}`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <UnitIdBadge value={client.unitId} />
              <Badge variant={client.smsConsent ? "success" : "muted"}>
                <MessageSquare className="size-3" />
                {client.smsConsent ? "SMS on" : "SMS off"}
              </Badge>
              {portal?.invited ? (
                <Badge variant={portalActive ? "success" : "muted"}>
                  {portalActive
                    ? portal.hasPin
                      ? "Portal on"
                      : "Portal · await PIN"
                    : "Portal off"}
                </Badge>
              ) : null}
            </div>
            {can("clients", "edit") ? (
              <>
                {portalActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={portalBusy}
                    onClick={() => void revokePortal()}
                  >
                    <ShieldOff className="size-4" />
                    Revoke portal
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={portalBusy}
                    onClick={() => void invitePortal()}
                  >
                    <ShieldCheck className="size-4" />
                    {portal?.invited ? "Restore portal" : "Invite to portal"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Location
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-medium text-navy">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {location || "—"}
                {client.address ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {client.address}
                  </span>
                ) : null}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Contact
            </p>
            <p className="mt-2 text-sm font-medium text-navy">
              {client.email ?? "No email"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[client.occupation, client.gender].filter(Boolean).join(" · ") ||
                "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Matters
            </p>
            <p className="mt-2 text-sm font-medium text-navy">{cases.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {client.referredBy
                ? `Referred by ${client.referredBy}`
                : "No referrer noted"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fees
            </p>
            {fee ? (
              <>
                <p className="mt-2 text-sm font-medium text-navy">
                  {fee.outstanding != null
                    ? `${rupee(fee.outstanding)} due`
                    : fee.collected > 0
                      ? `${rupee(fee.collected)} collected`
                      : "—"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Agreed {fee.agreedFee != null ? rupee(fee.agreedFee) : "—"} ·
                  Collected {rupee(fee.collected)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(client.fatherOrSpouse || client.matterBrief || client.notes) && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {client.fatherOrSpouse ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Father / spouse
                </p>
                <p className="mt-1 text-sm text-navy">{client.fatherOrSpouse}</p>
              </div>
            ) : null}
            {client.matterBrief ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Matter brief
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-navy">
                  {client.matterBrief}
                </p>
              </div>
            ) : null}
            {client.notes ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-navy">
                  {client.notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-navy">Cases</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Matters linked to this client
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={`/cases?clientUnitId=${client.unitId}`}>
                View in cases
              </Link>
            </Button>
            {can("cases", "create") ? (
              <Button asChild type="button" size="sm">
                <Link
                  href={`/cases?clientUnitId=${client.unitId}&new=1`}
                >
                  Register case
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <CardContent className="p-0 pt-0">
          {cases.length === 0 ? (
            <EmptyState compact title="No cases yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead className="hidden sm:table-cell">Court</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Next hearing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => {
                  const status = normalizeCaseStatus(c.status);
                  return (
                    <TableRow key={c.unitId}>
                      <TableCell>
                        <Link
                          href={`/cases/${c.unitId}`}
                          className="font-medium text-navy hover:underline"
                        >
                          {c.caseNumber ?? c.unitId}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.courtName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={CASE_STATUS_VARIANT[status] ?? "outline"}>
                          {CASE_STATUS_LABEL[status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.nextHearingAt
                          ? new Date(c.nextHearingAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {can("accounts", "view") ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
                <Wallet className="size-4" />
                Payments
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recent cash entries for this client
              </p>
            </div>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={`/accounts?clientUnitId=${client.unitId}`}>
                Open accounts
              </Link>
            </Button>
          </div>
          <CardContent className="p-0 pt-0">
            {payments.length === 0 ? (
              <EmptyState compact title="No payments yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Paid on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.unitId}>
                      <TableCell>{p.typeLabel}</TableCell>
                      <TableCell>{rupee(p.amount)}</TableCell>
                      <TableCell className="hidden capitalize sm:table-cell">
                        {p.status}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.paidOn
                          ? new Date(p.paidOn).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {can("cases", "view") ? (
        <CaseDocumentsPanel
          documents={documents}
          canUpload={can("cases", "upload")}
          canDelete={can("cases", "upload")}
          onUploadClick={openUpload}
          onDeleted={() => {
            void load();
          }}
        />
      ) : null}

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSaved={() => {
          void load();
        }}
      />

      {can("cases", "upload") ? (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clientUnitId={client.unitId}
          defaultDocType={uploadType}
          onUploaded={load}
        />
      ) : null}
    </section>
  );
}
