"use client";

import { useCallback, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { INDIA_STATES } from "@/lib/courts/india-states";
import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import { AsyncSearchSelect } from "@/shared/components/forms/async-search-select";

type CourtOption = { code: string; name: string };

type MetaPage = {
  options: CourtOption[];
  total: number;
};

type CourtCascadeProps = {
  state: string;
  district: string;
  city: string;
  courtName: string;
  onChange: (next: {
    state: string;
    district: string;
    city: string;
    courtName: string;
  }) => void;
};

const STATE_OPTIONS = INDIA_STATES.map((s) => ({
  value: s.name,
  label: s.name,
}));

async function fetchMetaPage(
  level: string,
  params: Record<string, string>,
  query: string,
  page: number,
  pageSize: number
): Promise<{ items: CourtOption[]; total: number }> {
  const q = new URLSearchParams({
    level,
    page: String(page),
    pageSize: String(pageSize),
    ...params,
  });
  if (query.trim()) q.set("q", query.trim());
  const { ok, data } = await apiFetch<MetaPage>(
    `/api/courts/meta?${q.toString()}`
  );
  if (!ok || !data || typeof data !== "object") {
    throw new Error("Failed to load court options");
  }
  const options = Array.isArray(data.options) ? data.options : [];
  const total = typeof data.total === "number" ? data.total : options.length;
  return { items: options, total };
}

function OtherFooter({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-2 text-left text-sm font-medium text-navy hover:bg-muted"
      onClick={onPick}
    >
      Other — type value
    </button>
  );
}

export function CourtCascade({
  state,
  district,
  city,
  courtName,
  onChange,
}: CourtCascadeProps) {
  const [customDistrict, setCustomDistrict] = useState(false);
  const [customCity, setCustomCity] = useState(false);
  const [customCourt, setCustomCourt] = useState(false);

  const stateCode = useMemo(
    () => INDIA_STATES.find((s) => s.name === state || s.code === state)?.code ?? state,
    [state]
  );

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
      if (!stateCode) return { items: [], total: 0 };
      return fetchMetaPage("districts", { state: stateCode }, query, page, pageSize);
    },
    [stateCode]
  );

  const fetchComplexes = useCallback(
    async ({
      query,
      page,
      pageSize,
    }: {
      query: string;
      page: number;
      pageSize: number;
    }) => {
      if (!stateCode || !district || customDistrict) {
        return { items: [], total: 0 };
      }
      return fetchMetaPage(
        "complexes",
        { state: stateCode, district },
        query,
        page,
        pageSize
      );
    },
    [stateCode, district, customDistrict]
  );

  const fetchCourts = useCallback(
    async ({
      query,
      page,
      pageSize,
    }: {
      query: string;
      page: number;
      pageSize: number;
    }) => {
      if (!stateCode || !district || !city || customDistrict || customCity) {
        return { items: [], total: 0 };
      }
      return fetchMetaPage(
        "courts",
        { state: stateCode, district, complex: city },
        query,
        page,
        pageSize
      );
    },
    [stateCode, district, city, customDistrict, customCity]
  );

  async function maybeAutoPickComplex(
    stateName: string,
    districtName: string,
    sc: string
  ) {
    const first = await fetchMetaPage(
      "complexes",
      { state: sc, district: districtName },
      "",
      1,
      2
    );
    if (first.total === 1 && first.items[0]) {
      const only = first.items[0];
      setCustomCity(false);
      setCustomCourt(false);
      onChange({
        state: stateName,
        district: districtName,
        city: only.name,
        courtName: "",
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        All India: State → District → City / complex → Court. Search or scroll
        for more; choose Other to type any name not listed.
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label>
            State <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            value={state}
            onChange={(name) => {
              setCustomDistrict(false);
              setCustomCity(false);
              setCustomCourt(false);
              onChange({
                state: name,
                district: "",
                city: "",
                courtName: "",
              });
            }}
            options={STATE_OPTIONS}
            placeholder="Select state"
            searchPlaceholder="Search state…"
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>
            District <span className="text-destructive">*</span>
          </Label>
          {customDistrict ? (
            <Input
              className="h-11"
              value={district}
              onChange={(e) =>
                onChange({
                  state,
                  district: e.target.value,
                  city,
                  courtName,
                })
              }
              placeholder="Type district name"
            />
          ) : (
            <AsyncSearchSelect<CourtOption>
              key={`district-${stateCode}`}
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
                setCustomCity(false);
                setCustomCourt(false);
                onChange({
                  state,
                  district: opt.name,
                  city: "",
                  courtName: "",
                });
                void maybeAutoPickComplex(state, opt.name, stateCode);
              }}
              footer={
                <OtherFooter
                  onPick={() => {
                    setCustomDistrict(true);
                    setCustomCity(true);
                    setCustomCourt(true);
                    onChange({
                      state,
                      district: "",
                      city: "",
                      courtName: "",
                    });
                  }}
                />
              }
            />
          )}
          {customDistrict ? (
            <button
              type="button"
              className="text-left text-xs text-navy hover:underline"
              onClick={() => {
                setCustomDistrict(false);
                setCustomCity(false);
                setCustomCourt(false);
                onChange({ state, district: "", city: "", courtName: "" });
              }}
            >
              Back to list
            </button>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>
            City / court complex <span className="text-destructive">*</span>
          </Label>
          {customDistrict || customCity ? (
            <Input
              className="h-11"
              value={city}
              onChange={(e) =>
                onChange({
                  state,
                  district,
                  city: e.target.value,
                  courtName,
                })
              }
              placeholder="Type city / complex"
            />
          ) : (
            <AsyncSearchSelect<CourtOption>
              key={`complex-${stateCode}-${district}`}
              value={city || null}
              selectedLabel={city || null}
              disabled={!district}
              placeholder={
                district ? "Select city / complex" : "Pick district first"
              }
              searchPlaceholder="Search city / complex…"
              fetchPage={fetchComplexes}
              getOptionValue={(o) => o.name}
              getOptionLabel={(o) => o.name}
              onChange={(opt) => {
                if (!opt) return;
                setCustomCity(false);
                setCustomCourt(false);
                onChange({
                  state,
                  district,
                  city: opt.name,
                  courtName: "",
                });
              }}
              footer={
                <OtherFooter
                  onPick={() => {
                    setCustomCity(true);
                    setCustomCourt(true);
                    onChange({ state, district, city: "", courtName: "" });
                  }}
                />
              }
            />
          )}
          {customCity && !customDistrict ? (
            <button
              type="button"
              className="text-left text-xs text-navy hover:underline"
              onClick={() => {
                setCustomCity(false);
                setCustomCourt(false);
                onChange({ state, district, city: "", courtName: "" });
              }}
            >
              Back to list
            </button>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>
            Court <span className="text-destructive">*</span>
          </Label>
          {customDistrict || customCity || customCourt ? (
            <Input
              className="h-11"
              value={courtName}
              onChange={(e) =>
                onChange({
                  state,
                  district,
                  city,
                  courtName: e.target.value,
                })
              }
              placeholder="Type court name"
            />
          ) : (
            <AsyncSearchSelect<CourtOption>
              key={`court-${stateCode}-${district}-${city}`}
              value={courtName || null}
              selectedLabel={courtName || null}
              disabled={!city}
              placeholder={city ? "Select court" : "Pick city first"}
              searchPlaceholder="Search court…"
              fetchPage={fetchCourts}
              getOptionValue={(o) => o.name}
              getOptionLabel={(o) => o.name}
              onChange={(opt) => {
                if (!opt) return;
                setCustomCourt(false);
                onChange({
                  state,
                  district,
                  city,
                  courtName: opt.name,
                });
              }}
              footer={
                <OtherFooter
                  onPick={() => {
                    setCustomCourt(true);
                    onChange({ state, district, city, courtName: "" });
                  }}
                />
              }
            />
          )}
          {customCourt && !customDistrict && !customCity ? (
            <button
              type="button"
              className="text-left text-xs text-navy hover:underline"
              onClick={() => {
                setCustomCourt(false);
                onChange({ state, district, city, courtName: "" });
              }}
            >
              Back to list
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
