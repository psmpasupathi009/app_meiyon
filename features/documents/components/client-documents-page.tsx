"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicUser } from "@/lib/auth/session";
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { DocumentSummary } from "@/features/documents/server/serialize";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/documents.schema";

export function ClientDocumentsPage({ user }: { user: PublicUser }) {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch<{ data: DocumentSummary[] }>(
      "/api/documents?pageSize=50"
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to load documents"
        )
      );
      return;
    }
    if (data && "data" in data) {
      setDocs((data as { data: DocumentSummary[] }).data);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (!user.clientUnitId) {
    return (
      <EmptyState
        title="Portal link missing"
        description="Ask the office to re-invite you to the client portal."
      />
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload ID proof, evidence, or other files for the office."
        actions={
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setUploadOpen(true)}
          >
            <FileUp className="size-4" />
            Upload
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload files the office needs — ID proof, evidence, or other papers."
          action={
            <Button type="button" onClick={() => setUploadOpen(true)}>
              Upload document
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {docs.map((d) => (
              <li key={d.unitId}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="text-sm font-medium text-navy">{d.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[
                          d.docType as keyof typeof DOCUMENT_TYPE_LABELS
                        ] ?? d.docType}
                        {" · "}
                        {new Date(d.createdAt).toLocaleDateString("en-IN")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.caseUnitId || d.clientUnitId || "—"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        void apiDownload(
                          `/api/documents/${d.unitId}/download`,
                          d.originalName || d.title
                        )
                      }
                    >
                      <Download className="size-3.5" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.unitId}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell>
                      {DOCUMENT_TYPE_LABELS[
                        d.docType as keyof typeof DOCUMENT_TYPE_LABELS
                      ] ?? d.docType}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.caseUnitId || d.clientUnitId || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void apiDownload(
                            `/api/documents/${d.unitId}/download`,
                            d.originalName || d.title
                          )
                        }
                      >
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientUnitId={user.clientUnitId}
        clientUploadOnly
        onUploaded={() => {
          void load();
        }}
      />
    </section>
  );
}
