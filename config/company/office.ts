/**
 * Manitham Law Foundation — office identity from staff address book
 * (private/office-files/address-and-mail.pdf, signed-in download).
 * Primary practice: Erode Dt., TN.
 */
export const office = {
  legalName: "Manitham Law Foundation",
  shortName: "MLF",
  /** Primary practice area for client intake defaults */
  defaultState: "Tamil Nadu",
  defaultDistrict: "Erode",
  /** Towns covered in the office address book */
  practiceTowns: [
    "Gobichettipalayam",
    "Nambiyur",
    "Sathyamangalam",
    "T.N.Palayam",
    "Vaniputhur",
  ] as const,
  /** Shown on legal pages / footer — update when office has a fixed chamber address */
  addressLines: [
    "Gobichettipalayam / Nambiyur region",
    "Erode District, Tamil Nadu",
  ] as const,
  contactEmail: "Senniappan.m@gmail.com",
  contactPhone: "9841578862",
  statesServed: ["Tamil Nadu", "Karnataka"] as const,
} as const;
