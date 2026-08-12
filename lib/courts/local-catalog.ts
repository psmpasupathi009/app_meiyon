/**
 * Offline court catalog for Register Case — no third-party API.
 * Source: all-India courts-seed + optional rows from existing Case records.
 * Staff can type any other district / city / court via “Other”.
 */
import {
  INDIA_STATES,
  resolveIndiaStateName,
  stateCodeFromName,
} from "@/lib/courts/india-states";
import { courtsSeed, type CourtSeed } from "@/config/company/courts-seed";
import { prisma } from "@meiyon/db";

export type CourtOption = { code: string; name: string };
export type CourtsSource = "seed" | "static" | "seed+db";

let cachedDbRows: CourtSeed[] | null = null;
let cachedDbAt = 0;
const DB_CACHE_MS = 60_000;

async function loadDbCourtRows(): Promise<CourtSeed[]> {
  const now = Date.now();
  if (cachedDbRows && now - cachedDbAt < DB_CACHE_MS) return cachedDbRows;
  try {
    const used = await prisma.case.findMany({
      where: {
        state: { not: null },
        district: { not: null },
        courtName: { not: null },
      },
      select: {
        state: true,
        district: true,
        city: true,
        courtName: true,
      },
      take: 500,
    });
    cachedDbRows = used.map((c) => ({
      state: c.state as string,
      district: c.district as string,
      city: (c.city || c.district) as string,
      courtName: c.courtName as string,
    }));
  } catch {
    cachedDbRows = [];
  }
  cachedDbAt = now;
  return cachedDbRows;
}

async function allRows(): Promise<{ rows: CourtSeed[]; source: CourtsSource }> {
  const db = await loadDbCourtRows();
  if (!db.length) return { rows: courtsSeed, source: "seed" };
  return { rows: [...courtsSeed, ...db], source: "seed+db" };
}

export function listIndiaStates(): {
  options: CourtOption[];
  source: CourtsSource;
} {
  return {
    options: INDIA_STATES.map((s) => ({ code: s.code, name: s.name })),
    source: "static",
  };
}

export async function listIndiaDistricts(stateCodeOrName: string): Promise<{
  options: CourtOption[];
  source: CourtsSource;
}> {
  const stateName = resolveIndiaStateName(stateCodeOrName);
  const { rows, source } = await allRows();
  const set = new Map<string, string>();
  for (const row of rows) {
    if (row.state !== stateName) continue;
    set.set(row.district, row.district);
  }
  return {
    options: Array.from(set.values())
      .sort((a, b) => a.localeCompare(b))
      .map((d) => ({ code: d, name: d })),
    source,
  };
}

export async function listIndiaComplexes(
  stateCodeOrName: string,
  districtName: string
): Promise<{ options: CourtOption[]; source: CourtsSource }> {
  const stateName = resolveIndiaStateName(stateCodeOrName);
  const { rows, source } = await allRows();
  const set = new Map<string, string>();
  for (const row of rows) {
    if (row.state !== stateName || row.district !== districtName) continue;
    const city = row.city || row.district;
    set.set(city, city);
  }
  return {
    options: Array.from(set.values())
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ code: c, name: c })),
    source,
  };
}

export async function listIndiaCourts(
  stateCodeOrName: string,
  districtName: string,
  cityOrComplex: string
): Promise<{ options: CourtOption[]; source: CourtsSource }> {
  const stateName = resolveIndiaStateName(stateCodeOrName);
  const { rows, source } = await allRows();
  const set = new Map<string, string>();
  for (const row of rows) {
    if (row.state !== stateName || row.district !== districtName) continue;
    const city = row.city || row.district;
    if (city !== cityOrComplex && row.district !== cityOrComplex) continue;
    set.set(row.courtName, row.courtName);
  }
  return {
    options: Array.from(set.values())
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ code: c, name: c })),
    source,
  };
}

export function stateCodeFor(name: string): string | undefined {
  return stateCodeFromName(name);
}
