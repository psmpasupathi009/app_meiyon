import { apiHandler, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { courtsSeed } from "@/config/company/courts-seed";

type CityNode = { city: string; courts: string[] };
type DistrictNode = { district: string; cities: CityNode[] };
type CascadeNode = { state: string; districts: DistrictNode[] };

type SeedLike = {
  state: string;
  district: string;
  city?: string | null;
  courtName: string;
};

function buildCascade(rows: SeedLike[]): CascadeNode[] {
  const stateMap = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const { state, district, city, courtName } of rows) {
    if (!state || !district || !courtName) continue;
    const cityKey = (city?.trim() || district).trim();
    if (!stateMap.has(state)) stateMap.set(state, new Map());
    const districtMap = stateMap.get(state)!;
    if (!districtMap.has(district)) districtMap.set(district, new Map());
    const cityMap = districtMap.get(district)!;
    if (!cityMap.has(cityKey)) cityMap.set(cityKey, new Set());
    cityMap.get(cityKey)!.add(courtName);
  }

  return Array.from(stateMap.entries())
    .map(([state, districtMap]) => ({
      state,
      districts: Array.from(districtMap.entries())
        .map(([district, cityMap]) => ({
          district,
          cities: Array.from(cityMap.entries())
            .map(([city, courts]) => ({
              city,
              courts: Array.from(courts).sort((a, b) => a.localeCompare(b)),
            }))
            .sort((a, b) => a.city.localeCompare(b.city)),
        }))
        .sort((a, b) => a.district.localeCompare(b.district)),
    }))
    .sort((a, b) => a.state.localeCompare(b.state));
}

/** Cascading state → district → city → court. Seed always works; used cases merge if DB ok. */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const all: SeedLike[] = [...courtsSeed];

  try {
    const usedCourts = await prisma.case.findMany({
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
    for (const c of usedCourts) {
      all.push({
        state: c.state as string,
        district: c.district as string,
        city: c.city || (c.district as string),
        courtName: c.courtName as string,
      });
    }
  } catch {
    // DB may not have new fields yet — seed alone is enough for the form
  }

  return jsonOk({ cascade: buildCascade(all) });
});
