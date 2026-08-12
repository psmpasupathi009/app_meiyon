/**
 * India states / UTs for eCourts-style codes (eCourtsIndia letter codes).
 * Used when live API is unavailable.
 */
export type IndiaState = {
  code: string;
  name: string;
};

export const INDIA_STATES: IndiaState[] = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OR", name: "Odisha" },
  { code: "PY", name: "Puducherry" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
  { code: "SC", name: "Supreme Court of India" },
];

export function stateCodeFromName(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  return INDIA_STATES.find((s) => s.name.toLowerCase() === n)?.code;
}

export function stateNameFromCode(code: string): string | undefined {
  return INDIA_STATES.find((s) => s.code === code.toUpperCase())?.name;
}

/** Accept eCourts letter code (e.g. TN) or full state name (e.g. Goa). */
export function resolveIndiaStateName(stateCodeOrName: string): string {
  const trimmed = stateCodeOrName.trim();
  if (!trimmed) return trimmed;
  return stateNameFromCode(trimmed) ?? trimmed;
}
