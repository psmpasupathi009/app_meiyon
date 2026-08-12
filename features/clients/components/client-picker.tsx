"use client";

import { useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import { AsyncSearchSelect } from "@/shared/components/forms/async-search-select";
import { fetchPagedList } from "@/shared/lib/fetch-paged-list";
import { ClientFormDialog } from "@/features/clients/components/client-form-dialog";
import type { ClientSummary } from "@/features/clients/server/serialize";

export function ClientPicker({
  value,
  onChange,
  label = "Client",
  placeholder = "Filter by client…",
  searchPlaceholder = "Search client by name or mobile…",
}: {
  value: { unitId: string; name: string } | null;
  onChange: (client: { unitId: string; name: string } | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPage = useCallback(
    ({
      query,
      page,
      pageSize,
    }: {
      query: string;
      page: number;
      pageSize: number;
    }) => fetchPagedList<ClientSummary>("/api/clients", { query, page, pageSize }),
    []
  );

  return (
    <div className="grid min-w-0 gap-2">
      {label ? <Label>{label}</Label> : null}
      <AsyncSearchSelect<ClientSummary>
        value={value?.unitId ?? null}
        selectedLabel={value ? `${value.name} (${value.unitId})` : null}
        onChange={(client) => {
          if (!client) {
            onChange(null);
            return;
          }
          onChange({ unitId: client.unitId, name: client.name });
        }}
        fetchPage={fetchPage}
        getOptionValue={(c) => c.unitId}
        getOptionLabel={(c) => `${c.name} (${c.unitId})`}
        renderOption={(c) => (
          <span className="block min-w-0 truncate">
            <span className="font-medium text-navy">{c.name}</span>{" "}
            <span className="text-muted-foreground">
              · +91 {c.mobile} · {c.unitId}
            </span>
          </span>
        )}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        clearable={Boolean(value)}
        clearLabel="Clear client"
        footer={
          label ? (
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-navy hover:bg-muted"
            onClick={() => setCreateOpen(true)}
          >
            + Add new client
          </button>
          ) : undefined
        }
      />

      <ClientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        client={null}
        onSaved={(client) =>
          onChange({ unitId: client.unitId, name: client.name })
        }
      />
    </div>
  );
}
