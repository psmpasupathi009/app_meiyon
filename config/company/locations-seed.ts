/**
 * Client address locations — State → District only.
 * Town / city is free text on the form (not seeded).
 * Separate from courts-seed (court complexes).
 *
 * Base districts from open MIT / LGD-aligned district data.
 */
import raw from "@/config/company/locations-seed.json";

export type LocationDistrict = {
  state: string;
  district: string;
};

export const locationsSeed = raw as LocationDistrict[];
