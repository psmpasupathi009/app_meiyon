"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage, apiFetch } from "@/lib/api/client";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentTypeValue,
} from "@/lib/validations/documents.schema";
import { CLIENT_UPLOAD_DOC_TYPES } from "@/lib/auth/client-portal";
import { cn } from "@/lib/utils/cn";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 10;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  caseUnitId,
  clientUnitId,
  defaultDocType = "other",
  clientUploadOnly = false,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseUnitId?: string;
  clientUnitId?: string;
  defaultDocType?: DocumentTypeValue;
  /** Restrict type picker to client-safe document types. */
  clientUploadOnly?: boolean;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [docType, setDocType] = useState<DocumentTypeValue>(defaultDocType);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const typeOptions = clientUploadOnly
    ? DOCUMENT_TYPES.filter((t) =>
        (CLIENT_UPLOAD_DOC_TYPES as readonly string[]).includes(t)
      )
    : DOCUMENT_TYPES;

  const reset = useCallback(() => {
    setTitle("");
    setNotes("");
    setDocType(
      clientUploadOnly &&
        !(CLIENT_UPLOAD_DOC_TYPES as readonly string[]).includes(defaultDocType)
        ? "other"
        : defaultDocType
    );
    setFile(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, [defaultDocType, clientUploadOnly]);

  function pickFile(next: File | null) {
    setError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB} MB)`);
      return;
    }
    const allowed = ACCEPT.split(",");
    if (next.type && !allowed.includes(next.type)) {
      setError("Only PDF, JPEG, PNG or WEBP files are allowed");
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit() {
    setError("");
    if (!file) {
      setError("Choose a file to upload");
      return;
    }

    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim() || file.name);
    form.set("docType", docType);
    if (notes.trim()) form.set("notes", notes.trim());
    if (caseUnitId) form.set("caseUnitId", caseUnitId);
    if (clientUnitId) form.set("clientUnitId", clientUnitId);

    setBusy(true);
    const { ok, data } = await apiFetch("/api/documents", {
      method: "POST",
      body: form,
    });
    setBusy(false);

    if (!ok) {
      setError(getErrorMessage(data as Record<string, unknown>, "Failed to upload document"));
      return;
    }

    toast.success(`${DOCUMENT_TYPE_LABELS[docType]} uploaded`);
    reset();
    onUploaded();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {clientUploadOnly ? "Upload document" : "Upload case document"}
          </DialogTitle>
          <DialogDescription>
            {clientUploadOnly
              ? `ID proof, evidence, or other files. PDF or image, max ${MAX_MB} MB.`
              : `Judgments, orders, pleadings and other case files. PDF or image, max ${MAX_MB} MB.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Document type</Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as DocumentTypeValue)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="z-200">
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Final judgment — OS/12/2024"
            />
          </div>

          <div className="grid gap-2">
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                dragging
                  ? "border-navy bg-secondary"
                  : "border-border bg-muted/30 hover:border-navy/40 hover:bg-muted/50"
              )}
            >
              <span className="rounded-full bg-card p-3 shadow-sm ring-1 ring-border">
                <Upload className="size-5 text-navy" />
              </span>
              <span className="text-sm font-medium text-navy">
                Drop file here or click to browse
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, WEBP
              </span>
            </button>

            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-navy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => pickFile(null)}
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-notes">Notes (optional)</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note for clerks / advocates"
              rows={2}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
