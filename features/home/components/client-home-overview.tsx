"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  FileUp,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import type { PublicUser } from "@/lib/auth/session";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { personFirstName } from "@/shared/lib/person";
import type { AppointmentSummary } from "@/features/appointments/server/serialize";
import { AppointmentFormDialog } from "@/features/appointments/components/appointment-form-dialog";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import {
  CASE_STATUS_LABEL,
  normalizeCaseStatus,
} from "@meiyon/config";

type CaseRow = {
  unitId: string;
  caseNumber: string | null;
  courtName: string | null;
  status: string;
  nextHearingAt: string | null;
  clientName?: string | null;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientHomeOverview({ user }: { user: PublicUser }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const [casesRes, apptRes] = await Promise.all([
      apiFetch<{ data: CaseRow[] }>("/api/cases?pageSize=5"),
      apiFetch<{ data: AppointmentSummary[] }>(
        `/api/appointments?pageSize=5&from=${encodeURIComponent(from.toISOString())}&status=scheduled`
      ),
    ]);
    setLoading(false);
    if (casesRes.ok && casesRes.data && "data" in casesRes.data) {
      setCases((casesRes.data as { data: CaseRow[] }).data);
    }
    if (apptRes.ok && apptRes.data && "data" in apptRes.data) {
      setAppointments(
        (apptRes.data as { data: AppointmentSummary[] }).data
      );
    }
    if (!casesRes.ok) {
      toast.error(
        getErrorMessage(
          casesRes.data as Record<string, unknown>,
          "Failed to load cases"
        )
      );
    }
    if (!apptRes.ok) {
      toast.error(
        getErrorMessage(
          apptRes.data as Record<string, unknown>,
          "Failed to load appointments"
        )
      );
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const first = personFirstName({
    name: user.name,
    fallback: "there",
  });

  const upcomingHearings = cases
    .filter((c) => c.nextHearingAt)
    .sort(
      (a, b) =>
        new Date(a.nextHearingAt!).getTime() -
        new Date(b.nextHearingAt!).getTime()
    )
    .slice(0, 5);

  return (
    <section className="space-y-6">
      <PageHeader
        title={`Welcome, ${first}`}
        description="View your cases and hearings, book an office visit or phone call, and upload documents."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setBookOpen(true)}
            >
              <CalendarDays className="size-4" />
              Book appointment
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setUploadOpen(true)}
            >
              <FileUp className="size-4" />
              Upload document
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Scale className="size-4 text-muted-foreground" />
                Next hearings
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cases">All cases</Link>
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcomingHearings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming hearing dates on file.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingHearings.map((c) => (
                  <li key={c.unitId}>
                    <Link
                      href={`/cases/${c.unitId}`}
                      className="block rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/40"
                    >
                      <p className="text-sm font-medium text-navy">
                        {c.caseNumber || c.unitId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(c.nextHearingAt!)}
                        {c.courtName ? ` · ${c.courtName}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                <CalendarDays className="size-4 text-muted-foreground" />
                Upcoming appointments
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/appointments">All</Link>
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scheduled appointments. Book an office visit or phone call.
              </p>
            ) : (
              <ul className="space-y-2">
                {appointments.map((a) => (
                  <li
                    key={a.unitId}
                    className="rounded-lg border border-border/60 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-navy">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(a.scheduledAt)}
                      {a.mode ? ` · ${a.mode}` : ""}
                      {a.advocateName ? ` · ${a.advocateName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy">Your cases</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cases linked yet. The office will add them after engagement.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cases.map((c) => (
                <li key={c.unitId} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <Link
                      href={`/cases/${c.unitId}`}
                      className="text-sm font-medium text-navy hover:underline"
                    >
                      {c.caseNumber || c.unitId}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {CASE_STATUS_LABEL[normalizeCaseStatus(c.status)] ??
                        c.status}
                      {c.courtName ? ` · ${c.courtName}` : ""}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/cases/${c.unitId}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AppointmentFormDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        appointment={null}
        formMode="create"
        user={user}
        onSaved={() => {
          setBookOpen(false);
          void load();
        }}
      />

      {user.clientUnitId ? (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clientUnitId={user.clientUnitId}
          clientUploadOnly
          onUploaded={() => {
            setUploadOpen(false);
            toast.success("Document uploaded");
          }}
        />
      ) : null}
    </section>
  );
}
