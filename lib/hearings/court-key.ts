/**
 * Default court preference on User.defaultCourts (JSON).
 */

export type DefaultCourt = {
  state: string;
  district: string;
  city: string;
  courtName: string;
};

export function courtKey(c: {
  state?: string | null;
  district?: string | null;
  city?: string | null;
  courtName?: string | null;
}): string {
  return [c.state, c.district, c.city, c.courtName]
    .map((x) => (x ?? "").trim().toLowerCase())
    .join("|");
}

export function parseDefaultCourts(raw: unknown): DefaultCourt[] {
  if (!Array.isArray(raw)) return [];
  const out: DefaultCourt[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const state = String(o.state ?? "").trim();
    const district = String(o.district ?? "").trim();
    const city = String(o.city ?? "").trim();
    const courtName = String(o.courtName ?? "").trim();
    if (!state || !district || !city || !courtName) continue;
    out.push({ state, district, city, courtName });
  }
  return out;
}

export function effectiveHearingAdvocate(input: {
  primaryAdvocateMobile?: string | null;
}): string | null {
  const primary = input.primaryAdvocateMobile?.trim();
  return primary || null;
}
