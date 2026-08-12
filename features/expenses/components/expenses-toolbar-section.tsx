"use client";

import { Download, Search } from "lucide-react";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORY_OPTIONS } from "@/features/expenses/lib/categories";

export type ExpensesToolbarSectionProps = {
  category: string;
  search: string;
  canExport: boolean;
  exporting: boolean;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onExport: () => void;
};

export function ExpensesToolbarSection({
  category,
  search,
  canExport,
  exporting,
  onCategoryChange,
  onSearchChange,
  onExport,
}: ExpensesToolbarSectionProps) {
  return (
    <DataToolbar
      search={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search EXP / vendor / description…"
            className="w-full pl-9"
          />
        </div>
      }
      filters={
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
