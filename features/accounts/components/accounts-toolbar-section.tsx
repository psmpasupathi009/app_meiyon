"use client";

import { Download, Search } from "lucide-react";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_PURPOSE_OPTIONS } from "@/features/accounts/lib/payment-purposes";

export type AccountsToolbarSectionProps = {
  purpose: string;
  search: string;
  clientPickerValue: { unitId: string; name: string } | null;
  canExport: boolean;
  exporting: boolean;
  onPurposeChange: (purpose: string) => void;
  onSearchChange: (search: string) => void;
  onClientChange: (client: { unitId: string; name: string } | null) => void;
  onExport: () => void;
};

export function AccountsToolbarSection({
  purpose,
  search,
  clientPickerValue,
  canExport,
  exporting,
  onPurposeChange,
  onSearchChange,
  onClientChange,
  onExport,
}: AccountsToolbarSectionProps) {
  return (
    <DataToolbar
      search={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search PAY / client / case…"
            className="w-full pl-9"
          />
        </div>
      }
      filters={
        <>
          <div className="w-full min-w-0 sm:w-56">
            <ClientPicker
              label=""
              value={clientPickerValue}
              onChange={onClientChange}
            />
          </div>
          <Select value={purpose} onValueChange={onPurposeChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All purposes</SelectItem>
              {PAYMENT_PURPOSE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      actions={
        canExport ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={exporting}
            onClick={onExport}
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        ) : undefined
      }
    />
  );
}
