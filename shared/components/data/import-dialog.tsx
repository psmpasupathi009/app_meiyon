"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { parseCsv } from "@/lib/utils/csv";
import { compliance } from "@/config/company/compliance";

type RowResult = {
  row: number;
  unitId: string | null;
  status: "ok" | "error";
  message: string;
};

type ImportResponse = {
  dryRun: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: RowResult[];
  ignoredColumns?: string[];
};

export function ImportDialog({
  open,
  onOpenChange,
  title,
  endpoint,
  sampleHref,
  columnsHint,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  endpoint: string;
  sampleHref?: string;
  /** Short note shown under the title, e.g. required CSV columns */
  columnsHint?: string;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runImport(parsedRows: Record<string, string>[], dryRun: boolean) {
    if (parsedRows.length === 0) return;
    setBusy(true);
    const { ok, data } = await apiFetch<ImportResponse>(endpoint, {
      method: "POST",
      json: { dryRun, rows: parsedRows },
    });
    setBusy(false);

    if (!ok) {
      toast.error(getErrorMessage(data as Record<string, unknown>, "Import failed"));
      return;
    }

    setResult(data);
    if (dryRun) {
      if (data.ignoredColumns && data.ignoredColumns.length > 0) {
        toast.message(
          `Ignored columns (not imported): ${data.ignoredColumns.join(", ")}`
        );
      }
      if (data.failed === 0) {
        toast.success(`Dry-run OK — ${data.succeeded} row(s) ready`);
      } else {
        toast.message(`Dry-run: ${data.succeeded} ready, ${data.failed} need fixing`);
      }
      return;
    }

    if (data.succeeded > 0) {
      toast.success(`Imported ${data.succeeded} of ${data.total} rows`);
      onImported();
    } else {
      toast.error(`Nothing imported — ${data.failed} row(s) failed`);
    }
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setRows(parsed);
    setResult(null);
    if (parsed.length === 0) {
      toast.error("No data rows found in that CSV");
      return;
    }
    // Auto dry-run so staff see problems immediately
    await runImport(parsed, true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Upload a CSV, review the dry-run, then confirm. Dates use YYYY-MM-DD
            (IST). Max {compliance.csv.maxRows} rows per file.
            {sampleHref ? (
              <>
                {" "}
                <a
                  href={sampleHref}
                  download
                  className="font-medium text-navy underline underline-offset-2"
                >
                  Download sample CSV
                </a>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {columnsHint ? (
            <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {columnsHint}
            </p>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {fileName ? (
            <p className="text-xs text-muted-foreground">
              {fileName} · {rows.length} row(s) parsed
              {busy ? " · checking…" : ""}
            </p>
          ) : null}

          {result ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              <p className="mb-1 text-sm font-medium text-navy">
                {result.succeeded}/{result.total} {result.dryRun ? "ready" : "imported"} ·{" "}
                {result.failed} failed
                {result.dryRun ? " (dry-run)" : ""}
              </p>
              {result.ignoredColumns && result.ignoredColumns.length > 0 ? (
                <p className="mb-1 text-xs text-amber-800">
                  Ignored columns: {result.ignoredColumns.join(", ")}
                </p>
              ) : null}
              {result.results.map((r) => (
                <div key={r.row} className="flex min-w-0 items-start gap-2 text-xs">
                  <Badge variant={r.status === "ok" ? "success" : "destructive"}>
                    row {r.row}
                  </Badge>
                  <span className="min-w-0 flex-1 break-words text-muted-foreground">
                    {r.unitId ? `${r.unitId} · ` : ""}
                    {r.message}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={rows.length === 0 || busy}
            onClick={() => void runImport(rows, true)}
          >
            Re-check
          </Button>
          <Button
            type="button"
            disabled={
              rows.length === 0 ||
              busy ||
              !result ||
              result.dryRun === false ||
              result.failed === result.total
            }
            onClick={() => void runImport(rows, false)}
          >
            Confirm import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
