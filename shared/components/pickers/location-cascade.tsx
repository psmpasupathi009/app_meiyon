"use client";

import { useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { ADDRESS_STATES } from "@/lib/locations/catalog";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import { AsyncSearchSelect } from "@/shared/components/forms/async-search-select";

type LocationOption = { code: string; name: string };

type MetaPage = {
  options: LocationOption[];
  total: number;
};

type Props = {
  state: string;
  district: string;
  city: string;
  onChange: (next: { state: string; district: string; city: string }) => void;
};

const STATE_OPTIONS = ADDRESS_STATES.map((s) => ({
  value: s.name,
  label: s.name,
}));

/**
 * Client residence: State + District from locations-seed; city is free text.
 */
export function LocationCascade({ state, district, city, onChange }: Props) {
  const [customDistrict, setCustomDistrict] = useState(false);

  const fetchDistricts = useCallback(
    async ({
      query,
      page,
      pageSize,
    }: {
      query: string;
      page: number;
      pageSize: number;
    }) => {
      if (!state) return { items: [], total: 0 };
      const q = new URLSearchParams({
        level: "districts",
        state,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) q.set("q", query.trim());
      const { ok, data } = await apiFetch<MetaPage>(
        `/api/locations/meta?${q.toString()}`
      );
      if (!ok || !data || typeof data !== "object") {
        throw new Error("Failed to load districts");
      }
      const options = Array.isArray(data.options) ? data.options : [];
      const total = typeof data.total === "number" ? data.total : options.length;
      return { items: options, total };
    },
    [state]
  );

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="grid min-w-0 gap-2">
        <Label>State</Label>
        <SearchableSelect
          value={state}
          onChange={(name) => {
            setCustomDistrict(false);
            onChange({ state: name, district: "", city: "" });
          }}
          options={STATE_OPTIONS}
          placeholder="Select state"
          searchPlaceholder="Search state…"
        />
      </div>

      <div className="grid min-w-0 gap-2">
        <Label>District</Label>
        {customDistrict ? (
          <>
            <Input
              value={district}
              placeholder="Type district"
              onChange={(e) =>
                onChange({ state, district: e.target.value, city })
              }
            />
            <button
              type="button"
              className="text-left text-xs text-navy hover:underline"
              onClick={() => {
                setCustomDistrict(false);
                onChange({ state, district: "", city });
              }}
            >
              Back to list
            </button>
          </>
        ) : (
          <AsyncSearchSelect<LocationOption>
            key={`loc-district-${state}`}
            value={district || null}
            selectedLabel={district || null}
            disabled={!state}
            placeholder={state ? "Select district" : "Pick state first"}
            searchPlaceholder="Search district…"
            fetchPage={fetchDistricts}
            getOptionValue={(o) => o.name}
            getOptionLabel={(o) => o.name}
            onChange={(opt) => {
              if (!opt) return;
              setCustomDistrict(false);
              onChange({ state, district: opt.name, city: "" });
            }}
            footer={
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-navy hover:bg-muted"
                onClick={() => {
                  setCustomDistrict(true);
                  onChange({ state, district: "", city: "" });
                }}
              >
                Other — type district
              </button>
            }
          />
        )}
      </div>

      <div className="grid min-w-0 gap-2 sm:col-span-2">
        <Label htmlFor="loc-city">Town / city (residence)</Label>
        <Input
          id="loc-city"
          value={city}
          placeholder="Type town / city / village"
          onChange={(e) =>
            onChange({ state, district, city: e.target.value })
          }
        />
      </div>
    </div>
  );
}
