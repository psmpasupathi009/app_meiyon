"use client";

import { useEffect, useRef, useState } from "react";
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
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_PAYMENT_MODE_OPTIONS,
} from "@/features/expenses/lib/categories";
import type { ExpenseSummary } from "@/features/expenses/server/serialize";
import { istDateKey } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 10;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseSummary | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(expense);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expenseDate, setExpenseDate] = useState("");
  const [category, setCategory] = useState("stationery");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      await Promise.resolve();
      if (expense) {
        if (expense.voidedAt) {
          onOpenChange(false);
          return;
        }
        setExpenseDate(istDateKey(new Date(expense.expenseDate)));
        setCategory(expense.category);
        setVendor(expense.vendor ?? "");
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setPaymentMode(expense.paymentMode);
      } else {
        setExpenseDate(istDateKey());
        setCategory("stationery");
        setVendor("");
        setDescription("");
        setAmount("");
        setPaymentMode("cash");
      }
      setFile(null);
      setDragging(false);
      setError("");
      if (fileRef.current) fileRef.current.value = "";
    })();
  }, [open, expense, onOpenChange]);

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
  }

  async function handleSubmit() {
    setError("");
    if (!expenseDate) {
      setError("Expense date is required");
      return;
    }
    if (!category) {
      setError("Select a category");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!paymentMode) {
      setError("Select a payment mode");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (
      (category === "others" || category === "misc") &&
      description.trim().length < 3
    ) {
      setError("Add a short note describing this expense");
      return;
    }
    if (!isEdit && !file) {
      setError("Attach the bill / receipt");
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.set("expenseDate", expenseDate);
    form.set("category", category);
    form.set("vendor", vendor.trim());
    form.set("description", description.trim());
    form.set("amount", String(amt));
    form.set("paymentMode", paymentMode || "cash");
    if (file) form.set("file", file);

    if (isEdit && expense) {
      const { ok, data } = await apiFetch(`/api/expenses/${expense.unitId}`, {
        method: "PATCH",
        body: form,
      });
      setBusy(false);
      if (!ok) {
        setError(
          getErrorMessage(data as Record<string, unknown>, "Failed to update")
        );
        return;
      }
      toast.success("Expense updated");
    } else {
      const { ok, data } = await apiFetch("/api/expenses", {
        method: "POST",
        body: form,
      });
      setBusy(false);
      if (!ok) {
        setError(
          getErrorMessage(data as Record<string, unknown>, "Failed to save")
        );
        return;
      }
      toast.success("Expense recorded");
    }

    onSaved();
    onOpenChange(false);
  }

  const needsDetailNote = category === "others" || category === "misc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" overlayClassName="z-[60]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit office expense" : "Record office expense"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details. Optionally replace the bill attachment."
              : "Enter the purchase and attach the bill (PDF or image)."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid min-w-0 gap-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label>Expense date</Label>
              <DatePicker value={expenseDate} onChange={setExpenseDate} />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Category</Label>
              <SearchableSelect
                value={category}
                onChange={setCategory}
                options={EXPENSE_CATEGORY_OPTIONS}
                placeholder="Category"
                searchPlaceholder="Search category…"
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Payment mode</Label>
              <SearchableSelect
                value={paymentMode}
                onChange={setPaymentMode}
                options={EXPENSE_PAYMENT_MODE_OPTIONS}
                placeholder="Mode"
                searchPlaceholder="Search mode…"
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="expense-vendor">Vendor (optional)</Label>
            <Input
              id="expense-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Shop / supplier name"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="expense-description">
              Description
              {needsDetailNote ? " (required detail)" : ""}
            </Label>
            <Textarea
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                needsDetailNote
                  ? "Describe what this Others / Miscellaneous expense was for"
                  : "What was purchased"
              }
              rows={3}
            />
          </div>

          <div className="grid min-w-0 gap-2">
            <Label>
              Bill / receipt
              {!isEdit ? " (required)" : " (optional replace)"}
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                <FileText className="size-4 shrink-0 text-navy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
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
                  "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors",
                  dragging
                    ? "border-navy/50 bg-navy/5"
                    : "border-border/80 bg-muted/20 hover:border-navy/40 hover:bg-muted/40"
                )}
              >
                <Upload className="size-5 text-navy" />
                <span>
                  {isEdit && expense?.billDocumentUnitId
                    ? "Replace bill — tap or drop (PDF, JPEG, PNG, WEBP · max 10 MB)"
                    : "Upload bill — tap or drop (PDF, JPEG, PNG, WEBP · max 10 MB)"}
                </span>
              </button>
            )}
            {isEdit && expense?.billDocumentUnitId && !file ? (
              <p className="text-xs text-muted-foreground">
                Current bill: {expense.billDocumentUnitId}
              </p>
            ) : null}
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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
