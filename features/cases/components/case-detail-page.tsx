"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  MapPin,
  Pencil,
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
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import type {
  CaseSummary,
  HearingSummary,
} from "@/features/cases/server/serialize";
import type { ClientSummary } from "@/features/clients/server/serialize";
import type { DocumentSummary } from "@/features/documents/server/serialize";
import { CaseFormDialog } from "@/features/cases/components/case-form-dialog";
import { AddHearingDialog } from "@/features/cases/components/add-hearing-dialog";
import { AdjournHearingDialog } from "@/features/cases/components/adjourn-hearing-dialog";
import { CaseCourtStatusStrip } from "@/features/cases/components/case-court-status-strip";
import { CaseFilingChecklist } from "@/features/cases/components/case-filing-checklist";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import { CaseDocumentsPanel } from "@/features/documents/components/case-documents-panel";
import type { DocumentTypeValue } from "@/lib/validations/documents.schema";
import {
  normalizeCaseStatus,
  PRE_NUMBER_STATUSES,
} from "@meiyon/config";

type DetailResponse = {
  case: CaseSummary;
  client: ClientSummary | null;
  hearings: HearingSummary[];
  documents: DocumentSummary[];
};

const CHECKLIST_STATUSES = new Set<string>(PRE_NUMBER_STATUSES);

export function CaseDetailPage({
  user,
  unitId,
}: {
  user: PublicUser;
  unitId: string;
}) {
  const can = (module: string, action: string) =>
    user.permissions.includes(`${module}.${action}`);
  const clientPortal = isClientOnlyUser(user.roles);

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [hearingOpen, setHearingOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentTypeValue>("other");
  const [adjourning, setAdjourning] = useState<string | null>(null);
  const [fee, setFee] = useState<{
    agreedFee: number | null;
    collected: number;
    outstanding: number | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch<DetailResponse>(
      `/api/cases/${unitId}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load case")
      );
      return;
    }
    setDetail(data as unknown as DetailResponse);

    if (user.permissions.includes("accounts.view")) {
      const feeRes = await apiFetch<{
        fee: {
          agreedFee: number | null;
          collected: number;
          outstanding: number | null;
        } | null;
      }>(`/api/accounts?caseUnitId=${encodeURIComponent(unitId)}&pageSize=1`);
      if (feeRes.ok) {
        const body = feeRes.data as unknown as {
          fee: {
            agreedFee: number | null;
            collected: number;
            outstanding: number | null;
          } | null;
        };
        setFee(body.fee ?? null);
      }
    } else {
      setFee(null);
    }
  }, [unitId, user.permissions]);

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
        title="Case not found"
        description="It may have been removed."
        action={
          <Button asChild variant="outline">
            <Link href="/cases">Back to cases</Link>
          </Button>
        }
      />
    );
  }

  const { case: item, client, hearings, documents } = detail;
  const status = normalizeCaseStatus(item.status);
  const showFilingChecklist =
    !clientPortal &&
    (CHECKLIST_STATUSES.has(status) ||
      (status === "active" && Boolean(item.battaDue)));

  function openUpload(docType: DocumentTypeValue = "other") {
    setUploadType(docType);
    setUploadOpen(true);
  }

  function applyCaseUpdate(next: CaseSummary) {
    setDetail((prev) => (prev ? { ...prev, case: next } : prev));
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild type="button" variant="ghost" size="sm" className="-ml-2">
          <Link href="/cases">
            <ArrowLeft className="size-4" />
            Cases
          </Link>
        </Button>
      </div>

      <PageHeader
        title={item.caseNumber ?? item.unitId}
        description={
          client
            ? `${client.name} · +${client.mobile}`
            : "Case file and case documents"
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <UnitIdBadge value={item.unitId} />
              {item.caseType ? (
                <Badge variant="outline">{item.caseType}</Badge>
              ) : null}
              {item.stage ? (
                <Badge variant="default">{item.stage}</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">No status</span>
              )}
            </div>
            {can("cases", "edit") ? (
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
            ) : null}
          </div>
        }
      />

      {!clientPortal ? (
        <CaseCourtStatusStrip
          caseItem={item}
          canEdit={can("cases", "edit")}
          onUpdated={applyCaseUpdate}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          <span className="font-medium text-navy">{status.replace(/_/g, " ")}</span>
        </p>
      )}

      {showFilingChecklist ? (
        <CaseFilingChecklist
          caseItem={item}
          canEdit={can("cases", "edit")}
          onUpdated={applyCaseUpdate}
        />
      ) : null}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Court
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-medium text-navy">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {item.courtName ?? "—"}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {[item.city, item.district, item.state]
                    .filter(Boolean)
                    .join(", ") || "Location not set"}
                </span>
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Next hearing
            </p>
            <p className="mt-2 text-sm font-medium text-navy">
              {item.nextHearingAt
                ? new Date(item.nextHearingAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Court case no.
            </p>
            <p className="mt-2 text-sm font-medium text-navy">
              {item.caseNumber ?? (
                <span className="text-amber-700 dark:text-amber-400">Not allotted yet</span>
              )}
            </p>
          </CardContent>
        </Card>
        {!clientPortal ? (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Agreed fee
              </p>
              <p className="mt-2 text-sm font-medium text-navy">
                {item.agreedFee != null
                  ? `₹${item.agreedFee.toLocaleString("en-IN")}`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Documents first — judgments/orders are primary office need */}
      <CaseDocumentsPanel
        documents={documents}
        canUpload={can("cases", "upload")}
        canDelete={!clientPortal && can("cases", "upload")}
        onUploadClick={openUpload}
        onDeleted={() => {
          void load();
        }}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-navy">Hearings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {clientPortal
                ? "Upcoming and past hearing dates"
                : "Diary dates and SMS status"}
            </p>
          </div>
          {can("cases", "edit") ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setHearingOpen(true)}
            >
              <CalendarPlus className="size-4" />
              Add hearing
            </Button>
          ) : null}
        </div>
        <CardContent className="p-0 pt-0">
          {hearings.length === 0 ? (
            <EmptyState compact title="No hearings recorded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="hidden md:table-cell">Outcome</TableHead>
                  {!clientPortal ? (
                    <TableHead className="hidden sm:table-cell">SMS</TableHead>
                  ) : null}
                  {!clientPortal ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {hearings.map((h) => (
                  <TableRow key={h.unitId}>
                    <TableCell>
                      {new Date(h.hearingDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>{h.purpose ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {h.outcome ?? (h.isAdjourned ? "Adjourned" : "—")}
                    </TableCell>
                    {!clientPortal ? (
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={h.smsSentAt ? "success" : "muted"}>
                          {h.smsSentAt ? "Sent" : "Pending"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {!clientPortal ? (
                      <TableCell className="text-right">
                        {can("cases", "edit") && !h.isAdjourned ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjourning(h.unitId)}
                          >
                            Adjourn
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {can("accounts", "view") ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-muted p-2.5 text-navy">
                  <Wallet className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-navy">Cash register</p>
                  <p className="text-sm text-muted-foreground">
                    Fee vs collected for {item.unitId} (actuals excluded)
                  </p>
                </div>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <Link href={`/accounts?caseUnitId=${item.unitId}`}>
                  Open accounts
                </Link>
              </Button>
            </div>
            {fee ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agreed fee
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy">
                    {fee.agreedFee != null
                      ? `₹${fee.agreedFee.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Collected
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy">
                    ₹{fee.collected.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy">
                    {fee.outstanding != null
                      ? `₹${fee.outstanding.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <CaseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        caseItem={{ ...item, clientName: client?.name ?? null }}
        onSaved={load}
      />
      <AddHearingDialog
        open={hearingOpen}
        onOpenChange={setHearingOpen}
        caseUnitId={item.unitId}
        caseType={item.caseType}
        onSaved={load}
      />
      {adjourning ? (
        <AdjournHearingDialog
          open={Boolean(adjourning)}
          onOpenChange={(v) => !v && setAdjourning(null)}
          hearingUnitId={adjourning}
          onSaved={load}
        />
      ) : null}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        caseUnitId={item.unitId}
        clientUnitId={clientPortal ? user.clientUnitId : client?.unitId}
        defaultDocType={uploadType}
        clientUploadOnly={clientPortal}
        onUploaded={load}
      />
    </section>
  );
}
