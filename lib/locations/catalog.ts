/**
 * Offline address location catalog for Client intake — no third-party API.
 * Source: locations-seed (all India state + district). City is typed by staff.
 * Supreme Court is not an address state.
 */
import { locationsSeed } from "@/config/company/locations-seed";
import {
  INDIA_STATES,
  resolveIndiaStateName,
} from "@/lib/courts/india-states";

export type LocationOption = { code: string; name: string };
export type LocationsSource = "seed" | "static";

/** Real states/UTs only — excludes “Supreme Court of India”. */
export const ADDRESS_STATES = INDIA_STATES.filter((s) => s.code !== "SC");

export function listLocationStates(): {
  options: LocationOption[];
  source: LocationsSource;
} {
  return {
    options: ADDRESS_STATES.map((s) => ({ code: s.code, name: s.name })),
    source: "static",
  };
}

export function listLocationDistricts(stateCodeOrName: string): {
  options: LocationOption[];
  source: LocationsSource;
} {
  const stateName = resolveIndiaStateName(stateCodeOrName);
  const set = new Map<string, string>();
  for (const row of locationsSeed) {
    if (row.state !== stateName) continue;
    set.set(row.district, row.district);
  }
  return {
    options: Array.from(set.values())
      .sort((a, b) => a.localeCompare(b))
      .map((d) => ({ code: d, name: d })),
    source: "seed",
  };
}
