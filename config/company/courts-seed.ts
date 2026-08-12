/**
 * All-India courts for Case Register:
 * State → District → City → Court
 *
 * Base: every Indian district gets STANDARD courts at HQ (court-districts.json).
 * Overlay: detailed TN/KA multi-city complexes (office practice).
 * Plus: all 25 High Courts + benches, and Supreme Court of India.
 *
 * Court-only — does not import address locations-seed.
 * No third-party live API. Edit this file to add courts / towns.
 */
import courtDistrictsRaw from "@/config/company/court-districts.json";

export type CourtSeed = {
  state: string;
  district: string;
  /** Town / city where the court complex sits */
  city: string;
  courtName: string;
};

type CourtDistrict = { state: string; district: string };

const courtDistricts = courtDistrictsRaw as CourtDistrict[];

const TN = "Tamil Nadu";
const KA = "Karnataka";
const SC_STATE = "Supreme Court of India";

const STANDARD = [
  "Principal District & Sessions Court",
  "Additional District Court",
  "Sub Court",
  "District Munsif Court",
  "Judicial Magistrate Court (JMFC)",
  "Chief Judicial Magistrate Court",
  "Family Court",
  "MACT (Motor Accident Claims Tribunal)",
  "Special Court (POCSO)",
  "Labour Court",
] as const;

const CITY_EXTRA = [
  "City Civil Court",
  "Assistant City Civil Court",
  "Metropolitan Magistrate Court",
  "Chief Metropolitan Magistrate Court",
  "Small Causes Court",
  "Commercial Court",
] as const;

function pack(
  state: string,
  district: string,
  city: string,
  courts: readonly string[]
): CourtSeed[] {
  return courts.map((courtName) => ({ state, district, city, courtName }));
}

function cityCourts(
  state: string,
  district: string,
  city: string,
  courts: readonly string[]
): CourtSeed[] {
  return pack(state, district, city, courts);
}

/** Districts that also have separate city court complexes */
const TN_MULTI_CITY: Record<string, { city: string; courts: string[] }[]> = {
  Erode: [
    {
      city: "Gobichettipalayam",
      courts: [
        "District Munsif Court, Gobichettipalayam",
        "JMFC, Gobichettipalayam",
        "Judicial Magistrate Court No.I, Gobichettipalayam",
        "Judicial Magistrate Court No.II, Gobichettipalayam",
        "Sub Court, Gobichettipalayam",
        "Subordinate Court, Gobichettipalayam",
        "III-Additional District Sessions Court, Gobichettipalayam",
        "Family Court, Gobichettipalayam",
      ],
    },
    {
      city: "Sathyamangalam",
      courts: [
        "District Munsif Court, Sathyamangalam",
        "Subordinate Court, Sathyamangalam",
        "JMFC, Sathyamangalam",
        "Judicial Magistrate Court, Sathyamangalam",
      ],
    },
    {
      city: "Nambiyur",
      courts: ["JMFC / Taluk Court, Nambiyur"],
    },
    {
      city: "Anthiyur",
      courts: ["District Munsif Court, Anthiyur"],
    },
    {
      city: "Bhavani",
      courts: [
        "District Munsif Court, Bhavani",
        "Subordinate Court, Bhavani",
        "JMFC, Bhavani",
        "Judicial Magistrate Court No.1, Bhavani",
        "Judicial Magistrate Court No.2, Bhavani",
        "Additional District Sessions Court, Bhavani",
      ],
    },
    {
      city: "Perundurai",
      courts: [
        "District Munsif Court, Perundurai",
        "Subordinate Court, Perundurai",
        "JMFC, Perundurai",
        "Judicial Magistrate Court, Perundurai",
      ],
    },
    {
      city: "Erode",
      courts: [
        ...STANDARD,
        ...CITY_EXTRA,
        "Principal District Court, Erode",
        "Mahila Court, Erode",
        "Principal District Munsif Court, Erode",
        "Principal District Subordinate Court, Erode",
        "Judicial Magistrate Court No.3, Erode",
        "Family Court, Erode",
        "Employee Compensation Court, Erode",
      ],
    },
  ],
  Coimbatore: [
    {
      city: "Coimbatore",
      courts: [
        ...STANDARD,
        ...CITY_EXTRA,
        "Labour Court",
        "Additional Subordinate Court, Coimbatore",
        "Principal District Munsif Court, Coimbatore",
      ],
    },
    {
      city: "Pollachi",
      courts: [
        "Sub Court, Pollachi",
        "District Munsif Court, Pollachi",
        "JMFC, Pollachi",
        "Judicial Magistrate Court, Pollachi",
      ],
    },
    {
      city: "Mettupalayam",
      courts: [
        "District Munsif Court, Mettupalayam",
        "Subordinate Court, Mettupalayam",
        "JMFC, Mettupalayam",
        "Judicial Magistrate Court, Mettupalayam",
      ],
    },
  ],
  Chennai: [
    {
      city: "Chennai",
      courts: [
        "Madras High Court (Principal Seat)",
        "Principal District Court, Chennai",
        "Chief Judicial Court, Chennai",
        "City Civil Court — Main (Madras High Court Campus)",
        "City Civil Court — Singaravelar Maligai",
        "City Civil Court — Egmore",
        ...CITY_EXTRA,
        "Family Court",
        "MACT (Motor Accident Claims Tribunal)",
        "Labour Court",
        "Consumer Disputes Redressal Commission",
      ],
    },
  ],
  Madurai: [
    {
      city: "Madurai",
      courts: [
        "Madurai Bench of Madras High Court",
        ...STANDARD,
        ...CITY_EXTRA,
        "Labour Court",
      ],
    },
  ],
  Salem: [
    { city: "Salem", courts: [...STANDARD, ...CITY_EXTRA] },
    {
      city: "Attur",
      courts: [
        "District Munsif Court, Attur",
        "Subordinate Court, Attur",
        "JMFC, Attur",
      ],
    },
    {
      city: "Mettur",
      courts: ["District Munsif Court, Mettur", "JMFC, Mettur"],
    },
    {
      city: "Omalur",
      courts: ["District Munsif Court, Omalur", "JMFC, Omalur"],
    },
  ],
  Namakkal: [
    {
      city: "Namakkal",
      courts: [...STANDARD],
    },
    {
      city: "Komarapalayam",
      courts: ["Judicial Magistrate Court, Komarapalayam", "JMFC, Komarapalayam"],
    },
  ],
  Dharmapuri: [
    {
      city: "Dharmapuri",
      courts: [...STANDARD],
    },
    {
      city: "Pappireddipatti",
      courts: [
        "Judicial Magistrate Court, Papirettipatti",
        "JMFC, Pappireddipatti",
      ],
    },
  ],
  Thanjavur: [
    {
      city: "Thanjavur",
      courts: [
        ...STANDARD,
        ...CITY_EXTRA,
        "Judicial Magistrate Court No.1, Thanjavur",
      ],
    },
  ],
  Tirunelveli: [
    {
      city: "Tirunelveli",
      courts: [
        ...STANDARD,
        ...CITY_EXTRA,
        "Special Subordinate Court, Tirunelveli",
      ],
    },
  ],
  Tiruchirappalli: [
    { city: "Tiruchirappalli", courts: [...STANDARD, ...CITY_EXTRA] },
    {
      city: "Srirangam",
      courts: ["JMFC, Srirangam"],
    },
  ],
  /** LGD / locations-seed spelling is Kanyakumari (not Kanniyakumari). */
  Kanyakumari: [
    {
      city: "Nagercoil",
      courts: [
        "Principal District & Sessions Court, Nagercoil",
        ...STANDARD,
        "City Civil Court, Nagercoil",
      ],
    },
    {
      city: "Padmanabhapuram",
      courts: [
        "District Munsif Court, Padmanabhapuram",
        "JMFC, Padmanabhapuram",
      ],
    },
  ],
  Tiruppur: [
    {
      city: "Tiruppur",
      courts: [
        ...STANDARD,
        ...CITY_EXTRA,
        "Additional District Court, Tiruppur",
        "Principal District Munsif Court, Tiruppur",
        "Family Court, Tiruppur",
        "Special Tribunal Court, Tiruppur",
      ],
    },
    {
      city: "Avinashi",
      courts: [
        "District Munsif Court, Avinashi",
        "Subordinate Court, Avinashi",
        "Judicial Magistrate Court, Avinashi",
      ],
    },
    {
      city: "Palladam",
      courts: [
        "Subordinate Court, Palladam",
        "Judicial Magistrate Court, Palladam",
      ],
    },
    {
      city: "Uthukuli",
      courts: ["District Munsif Court, Uthukuli"],
    },
    {
      city: "Kangeyam",
      courts: ["Subordinate Court, Kangeyam"],
    },
    {
      city: "Dharapuram",
      courts: ["District Munsif Court, Dharapuram", "JMFC, Dharapuram"],
    },
    {
      city: "Udumalpet",
      courts: ["JMFC, Udumalpet"],
    },
  ],
  Vellore: [
    { city: "Vellore", courts: [...STANDARD, ...CITY_EXTRA] },
    {
      city: "Gudiyatham",
      courts: ["District Munsif Court, Gudiyatham", "JMFC, Gudiyatham"],
    },
  ],
};

const KA_MULTI_CITY: Record<string, { city: string; courts: string[] }[]> = {
  "Bengaluru Urban": [
    {
      city: "Bengaluru",
      courts: [
        "High Court of Karnataka (Principal Bench)",
        "City Civil Court, Bengaluru",
        "Mayo Hall Court Complex",
        "CMM Courts, Bengaluru",
        "Commercial Court, Bengaluru",
        "Additional Chief Judicial Magistrate Court, Bangalore",
        ...STANDARD,
        ...CITY_EXTRA,
      ],
    },
  ],
  Chamarajanagara: [
    {
      city: "Chamarajanagara",
      courts: [...STANDARD],
    },
    {
      city: "Kollegal",
      courts: [
        "Judicial Magistrate Fastrack Court, Kollegal",
        "JMFC, Kollegal",
      ],
    },
  ],
  "Bengaluru Rural": [
    { city: "Bengaluru Rural", courts: [...STANDARD] },
    {
      city: "Nelamangala",
      courts: ["JMFC, Nelamangala"],
    },
    {
      city: "Doddaballapur",
      courts: ["JMFC, Doddaballapur"],
    },
  ],
  "Dakshina Kannada": [
    {
      city: "Mangaluru",
      courts: [
        "District Court, Mangaluru",
        "City Civil Court, Mangaluru",
        "Family Court, Mangaluru",
        ...STANDARD,
        ...CITY_EXTRA,
      ],
    },
    {
      city: "Puttur",
      courts: ["JMFC, Puttur", "District Munsif Court, Puttur"],
    },
  ],
  Mysuru: [
    {
      city: "Mysuru",
      courts: ["City Civil Court, Mysuru", ...STANDARD, ...CITY_EXTRA],
    },
  ],
  Dharwad: [
    {
      city: "Hubballi",
      courts: [
        "High Court of Karnataka — Dharwad Bench",
        "District Court, Hubballi-Dharwad",
        "City Civil Court, Hubballi",
        ...STANDARD,
        ...CITY_EXTRA,
      ],
    },
    {
      city: "Dharwad",
      courts: ["District Court, Dharwad", "JMFC, Dharwad", "Family Court"],
    },
  ],
  Kalaburagi: [
    {
      city: "Kalaburagi",
      courts: [
        "High Court of Karnataka — Kalaburagi Bench",
        ...STANDARD,
        ...CITY_EXTRA,
      ],
    },
  ],
  Belagavi: [
    { city: "Belagavi", courts: [...STANDARD, ...CITY_EXTRA] },
  ],
  Udupi: [
    { city: "Udupi", courts: [...STANDARD] },
    {
      city: "Kundapura",
      courts: ["JMFC, Kundapura"],
    },
  ],
};

const TN_CITY_DISTRICTS = new Set([
  "Coimbatore",
  "Madurai",
  "Salem",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tiruppur",
  "Erode",
  "Vellore",
  "Thoothukudi",
  "Chennai",
]);

const KA_CITY_DISTRICTS = new Set([
  "Mysuru",
  "Belagavi",
  "Kalaburagi",
  "Shivamogga",
  "Tumakuru",
  "Davanagere",
  "Bengaluru Urban",
  "Dakshina Kannada",
  "Dharwad",
]);

/**
 * Capitals + major metros get CITY_EXTRA (City Civil, MM, CMM, etc.)
 * at district HQ. Keyed as `state::district` to match court-districts.json.
 * Overlay TN/KA multi-city districts are skipped in buildAllIndia — they keep
 * their own city packs.
 */
const METRO_OR_CAPITAL = new Set<string>([
  // Capitals / seats of government
  "Andaman and Nicobar Islands::South Andaman",
  "Andhra Pradesh::Guntur", // Amaravati region
  "Arunachal Pradesh::Itanagar capital complex",
  "Assam::Kamrup Metropolitan",
  "Bihar::Patna",
  "Chandigarh::Chandigarh",
  "Chhattisgarh::Raipur",
  "Dadra and Nagar Haveli and Daman and Diu::Daman",
  "Delhi::New Delhi",
  "Delhi::Central Delhi",
  "Delhi::South Delhi",
  "Delhi::East Delhi",
  "Delhi::West Delhi",
  "Delhi::North Delhi",
  "Delhi::North East Delhi",
  "Delhi::North West Delhi",
  "Delhi::South East Delhi",
  "Delhi::South West Delhi",
  "Delhi::Shahdara district",
  "Goa::North Goa",
  "Gujarat::Ahmedabad",
  "Gujarat::Gandhinagar",
  "Haryana::Gurugram",
  "Haryana::Faridabad",
  "Himachal Pradesh::Shimla",
  "Jammu and Kashmir::Srinagar",
  "Jammu and Kashmir::Jammu",
  "Jharkhand::Ranchi",
  "Jharkhand::East Singhbhum",
  "Karnataka::Bengaluru Urban",
  "Kerala::Thiruvananthapuram",
  "Kerala::Ernakulam",
  "Ladakh::Leh",
  "Lakshadweep::Lakshadweep",
  "Madhya Pradesh::Bhopal",
  "Madhya Pradesh::Indore",
  "Maharashtra::Mumbai City",
  "Maharashtra::Mumbai Suburban",
  "Maharashtra::Pune",
  "Maharashtra::Nagpur",
  "Maharashtra::Thane",
  "Maharashtra::Nashik",
  "Manipur::Imphal West",
  "Manipur::Imphal East",
  "Meghalaya::East Khasi Hills",
  "Mizoram::Aizawl",
  "Nagaland::Kohima",
  "Nagaland::Dimapur",
  "Odisha::Khordha",
  "Odisha::Cuttack",
  "Puducherry::Puducherry",
  "Punjab::Ludhiana",
  "Punjab::Amritsar",
  "Punjab::Jalandhar",
  "Rajasthan::Jaipur",
  "Rajasthan::Jodhpur",
  "Sikkim::East Sikkim",
  "Tamil Nadu::Chennai",
  "Tamil Nadu::Coimbatore",
  "Tamil Nadu::Madurai",
  "Telangana::Hyderabad",
  "Tripura::West Tripura",
  "Uttar Pradesh::Lucknow",
  "Uttar Pradesh::Prayagraj",
  "Uttar Pradesh::Varanasi",
  "Uttar Pradesh::Kanpur Nagar",
  "Uttar Pradesh::Ghaziabad",
  "Uttar Pradesh::Gautam Buddha Nagar",
  "Uttarakhand::Dehradun",
  "West Bengal::Kolkata",
  "West Bengal::Howrah",
  "West Bengal::North 24 Parganas",
  "West Bengal::South 24 Parganas",
]);

function wantsCityExtra(state: string, district: string): boolean {
  if (METRO_OR_CAPITAL.has(`${state}::${district}`)) return true;
  if (state === TN && TN_CITY_DISTRICTS.has(district)) return true;
  if (state === KA && KA_CITY_DISTRICTS.has(district)) return true;
  return false;
}

/**
 * All 25 High Courts + permanent/circuit benches (public directory).
 * Rows sit in the same seed as district courts.
 */
const HIGH_COURT_BENCHES: CourtSeed[] = [
  // Allahabad
  {
    state: "Uttar Pradesh",
    district: "Prayagraj",
    city: "Prayagraj",
    courtName: "Allahabad High Court (Principal Seat)",
  },
  {
    state: "Uttar Pradesh",
    district: "Lucknow",
    city: "Lucknow",
    courtName: "Allahabad High Court — Lucknow Bench",
  },
  // Andhra Pradesh
  {
    state: "Andhra Pradesh",
    district: "Guntur",
    city: "Amaravati",
    courtName: "Andhra Pradesh High Court (Principal Seat)",
  },
  // Bombay
  {
    state: "Maharashtra",
    district: "Mumbai City",
    city: "Mumbai",
    courtName: "Bombay High Court (Principal Seat)",
  },
  {
    state: "Maharashtra",
    district: "Aurangabad",
    city: "Aurangabad",
    courtName: "Bombay High Court — Aurangabad Bench",
  },
  {
    state: "Maharashtra",
    district: "Nagpur",
    city: "Nagpur",
    courtName: "Bombay High Court — Nagpur Bench",
  },
  {
    state: "Goa",
    district: "North Goa",
    city: "Panaji",
    courtName: "Bombay High Court — Goa Bench (Panaji)",
  },
  {
    state: "Maharashtra",
    district: "Kolhapur",
    city: "Kolhapur",
    courtName: "Bombay High Court — Kolhapur Bench",
  },
  // Calcutta
  {
    state: "West Bengal",
    district: "Kolkata",
    city: "Kolkata",
    courtName: "Calcutta High Court (Principal Seat)",
  },
  {
    state: "Andaman and Nicobar Islands",
    district: "South Andaman",
    city: "Port Blair",
    courtName: "Calcutta High Court — Port Blair Circuit Bench",
  },
  {
    state: "West Bengal",
    district: "Jalpaiguri",
    city: "Jalpaiguri",
    courtName: "Calcutta High Court — Jalpaiguri Bench",
  },
  // Chhattisgarh
  {
    state: "Chhattisgarh",
    district: "Bilaspur",
    city: "Bilaspur",
    courtName: "Chhattisgarh High Court (Principal Seat)",
  },
  // Delhi
  {
    state: "Delhi",
    district: "New Delhi",
    city: "New Delhi",
    courtName: "Delhi High Court (Principal Seat)",
  },
  // Gauhati
  {
    state: "Assam",
    district: "Kamrup Metropolitan",
    city: "Guwahati",
    courtName: "Gauhati High Court (Principal Seat)",
  },
  {
    state: "Nagaland",
    district: "Kohima",
    city: "Kohima",
    courtName: "Gauhati High Court — Kohima Bench",
  },
  {
    state: "Mizoram",
    district: "Aizawl",
    city: "Aizawl",
    courtName: "Gauhati High Court — Aizawl Bench",
  },
  {
    state: "Arunachal Pradesh",
    district: "Papum Pare",
    city: "Itanagar",
    courtName: "Gauhati High Court — Itanagar Bench",
  },
  // Gujarat
  {
    state: "Gujarat",
    district: "Ahmedabad",
    city: "Ahmedabad",
    courtName: "Gujarat High Court (Principal Seat)",
  },
  {
    state: "Gujarat",
    district: "Rajkot",
    city: "Rajkot",
    courtName: "Gujarat High Court — Rajkot Bench",
  },
  // Himachal Pradesh
  {
    state: "Himachal Pradesh",
    district: "Shimla",
    city: "Shimla",
    courtName: "Himachal Pradesh High Court (Principal Seat)",
  },
  // J&K and Ladakh
  {
    state: "Jammu and Kashmir",
    district: "Srinagar",
    city: "Srinagar",
    courtName: "High Court of Jammu & Kashmir and Ladakh — Srinagar",
  },
  {
    state: "Jammu and Kashmir",
    district: "Jammu",
    city: "Jammu",
    courtName: "High Court of Jammu & Kashmir and Ladakh — Jammu",
  },
  // Jharkhand
  {
    state: "Jharkhand",
    district: "Ranchi",
    city: "Ranchi",
    courtName: "Jharkhand High Court (Principal Seat)",
  },
  // Karnataka (also listed in KA_MULTI_CITY — deduped below)
  {
    state: KA,
    district: "Bengaluru Urban",
    city: "Bengaluru",
    courtName: "High Court of Karnataka (Principal Bench)",
  },
  {
    state: KA,
    district: "Dharwad",
    city: "Hubballi",
    courtName: "High Court of Karnataka — Dharwad Bench",
  },
  {
    state: KA,
    district: "Kalaburagi",
    city: "Kalaburagi",
    courtName: "High Court of Karnataka — Kalaburagi Bench",
  },
  // Kerala
  {
    state: "Kerala",
    district: "Ernakulam",
    city: "Ernakulam",
    courtName: "Kerala High Court (Principal Seat)",
  },
  // Madhya Pradesh
  {
    state: "Madhya Pradesh",
    district: "Jabalpur",
    city: "Jabalpur",
    courtName: "Madhya Pradesh High Court (Principal Seat)",
  },
  {
    state: "Madhya Pradesh",
    district: "Indore",
    city: "Indore",
    courtName: "Madhya Pradesh High Court — Indore Bench",
  },
  {
    state: "Madhya Pradesh",
    district: "Gwalior",
    city: "Gwalior",
    courtName: "Madhya Pradesh High Court — Gwalior Bench",
  },
  // Madras (also in TN_MULTI_CITY — deduped)
  {
    state: TN,
    district: "Chennai",
    city: "Chennai",
    courtName: "Madras High Court (Principal Seat)",
  },
  {
    state: TN,
    district: "Madurai",
    city: "Madurai",
    courtName: "Madurai Bench of Madras High Court",
  },
  // Manipur
  {
    state: "Manipur",
    district: "Imphal West",
    city: "Imphal",
    courtName: "Manipur High Court (Principal Seat)",
  },
  // Meghalaya
  {
    state: "Meghalaya",
    district: "East Khasi Hills",
    city: "Shillong",
    courtName: "Meghalaya High Court (Principal Seat)",
  },
  // Orissa
  {
    state: "Odisha",
    district: "Cuttack",
    city: "Cuttack",
    courtName: "Orissa High Court (Principal Seat)",
  },
  // Patna
  {
    state: "Bihar",
    district: "Patna",
    city: "Patna",
    courtName: "Patna High Court (Principal Seat)",
  },
  // Punjab and Haryana
  {
    state: "Chandigarh",
    district: "Chandigarh",
    city: "Chandigarh",
    courtName: "Punjab and Haryana High Court (Principal Seat)",
  },
  // Rajasthan
  {
    state: "Rajasthan",
    district: "Jodhpur",
    city: "Jodhpur",
    courtName: "Rajasthan High Court (Principal Seat)",
  },
  {
    state: "Rajasthan",
    district: "Jaipur",
    city: "Jaipur",
    courtName: "Rajasthan High Court — Jaipur Bench",
  },
  // Sikkim
  {
    state: "Sikkim",
    district: "East Sikkim",
    city: "Gangtok",
    courtName: "Sikkim High Court (Principal Seat)",
  },
  // Telangana
  {
    state: "Telangana",
    district: "Hyderabad",
    city: "Hyderabad",
    courtName: "Telangana High Court (Principal Seat)",
  },
  // Tripura
  {
    state: "Tripura",
    district: "West Tripura",
    city: "Agartala",
    courtName: "Tripura High Court (Principal Seat)",
  },
  // Uttarakhand
  {
    state: "Uttarakhand",
    district: "Nainital",
    city: "Nainital",
    courtName: "Uttarakhand High Court (Principal Seat)",
  },
];

const SUPREME_COURT: CourtSeed[] = [
  {
    state: SC_STATE,
    district: "New Delhi",
    city: "New Delhi",
    courtName: "Supreme Court of India",
  },
];

function buildOverlay(
  state: string,
  multi: Record<string, { city: string; courts: string[] }[]>
): CourtSeed[] {
  const rows: CourtSeed[] = [];
  for (const [district, cities] of Object.entries(multi)) {
    for (const { city, courts } of cities) {
      rows.push(...cityCourts(state, district, city, courts));
    }
  }
  return rows;
}

function buildAllIndiaDistrictCourts(): CourtSeed[] {
  const overlayDistricts = new Set<string>([
    ...Object.keys(TN_MULTI_CITY).map((d) => `${TN}::${d}`),
    ...Object.keys(KA_MULTI_CITY).map((d) => `${KA}::${d}`),
  ]);

  const rows: CourtSeed[] = [];
  for (const loc of courtDistricts) {
    const key = `${loc.state}::${loc.district}`;
    if (overlayDistricts.has(key)) continue;

    const cityPack = wantsCityExtra(loc.state, loc.district)
      ? [...STANDARD, ...CITY_EXTRA]
      : [...STANDARD];

    rows.push(...pack(loc.state, loc.district, loc.district, cityPack));
  }
  return rows;
}

function dedupe(rows: CourtSeed[]): CourtSeed[] {
  const seen = new Set<string>();
  const out: CourtSeed[] = [];
  for (const row of rows) {
    const k = `${row.state}|${row.district}|${row.city}|${row.courtName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

export const courtsSeed: CourtSeed[] = dedupe([
  ...buildAllIndiaDistrictCourts(),
  ...buildOverlay(TN, TN_MULTI_CITY),
  ...buildOverlay(KA, KA_MULTI_CITY),
  ...HIGH_COURT_BENCHES,
  ...SUPREME_COURT,
  // Office practice courts from staffs & court details.pdf (other states)
  {
    state: "West Bengal",
    district: "Kolkata",
    city: "Kolkata",
    courtName: "Metropolitan Magistrate Court, Kolkata",
  },
]);

/** States present in the courts seed (includes Supreme Court path). */
export const COURT_STATES = Array.from(
  new Set(courtsSeed.map((r) => r.state))
).sort((a, b) => a.localeCompare(b));
