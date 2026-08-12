"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

export function UnitIdBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copied ${value}`);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${value}`}
      className={cn(
        "inline-flex min-h-8 max-w-full items-center gap-1.5 truncate rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs text-navy transition-colors hover:border-navy/30 hover:bg-card",
        className
      )}
      data-unit-id-badge=""
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-50" />
      )}
    </button>
  );
}
