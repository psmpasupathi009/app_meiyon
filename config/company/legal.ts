import { brand } from "@/config/company/brand";
import { office } from "@/config/company/office";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalPage = {
  slug: "terms" | "consultation-policy" | "privacy";
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

/**
 * Firm policies for the portal. Drafted for Indian advocate-office practice
 * (BCI professional conduct, client intake / KYC last-4, consultation vs
 * engagement). Not a substitute for a signed engagement letter or vakalatnama.
 */
export const legalPages: LegalPage[] = [
  {
    slug: "terms",
    title: "Terms of use",
    updatedAt: "2026-07-23",
    intro: `These terms govern use of the ${brand.name} (${office.shortName}) advocate office portal by authorised staff and, where applicable, information shown to clients. Court representation begins only after engagement and vakalatnama as required.`,
    sections: [
      {
        heading: "1. Nature of this portal",
        paragraphs: [
          "This website/portal is an internal office system for case register, client records, hearings, documents, cash receipts, and appointments. It is not an open public marketplace for legal advice.",
          "Information entered by staff must be accurate. Unit IDs (CLI / CSE / PAY / etc.) are office reference numbers and are separate from court case numbers and CNR.",
        ],
      },
      {
        heading: "2. No guarantee of outcome",
        paragraphs: [
          `Legal proceedings depend on facts, evidence, law, and the court. ${brand.name} and its advocates do not guarantee any particular result, order, or timeline.`,
          "Fee arrangements, if any, follow a separate written understanding. Contingent “success fee” sharing of the claim amount is not practised contrary to professional rules.",
        ],
      },
      {
        heading: "3. Client engagement",
        paragraphs: [
          "A consultation does not by itself create a court retainer. Full engagement for a matter typically requires: conflict check, agreed scope, fee clarity, and (for court) vakalatnama / authorisation.",
          "The client must disclose known opposite parties and related persons so the office can avoid conflicts of interest.",
        ],
      },
      {
        heading: "4. Fees, advances and receipts",
        paragraphs: [
          "Advances and stage payments are recorded in the office cash register (PAY-#####). Court fees, stamps, copying, travel, and clerkage (where applicable) are usually extra and payable by the client against actuals.",
          "Only authorised staff may issue or upload payment receipts. Disputes on amounts should be raised promptly with the office.",
        ],
      },
      {
        heading: "5. Documents and confidentiality",
        paragraphs: [
          "Pleadings, judgments, ID proofs, and notes stored here are confidential office records. Staff must not share them outside authorised channels.",
          "Full Aadhaar / PAN numbers should not be stored in the system — last-4 digits only where needed for identification.",
        ],
      },
      {
        heading: "6. Acceptable use (staff)",
        paragraphs: [
          "Login credentials are personal. Do not share PIN/OTP. Report lost devices immediately to admin.",
          "Misuse of client data, unauthorised deletion, or bypassing permissions may lead to account deactivation and other action.",
        ],
      },
      {
        heading: "7. Limitation",
        paragraphs: [
          `To the extent permitted by law, ${brand.name} is not liable for indirect loss arising from portal downtime, SMS delay, or third-party court/eCourts systems.`,
          "These terms may be updated; the “Updated” date on this page is controlling for the portal copy.",
        ],
      },
      {
        heading: "8. Court lists and third-party data",
        paragraphs: [
          "Court / district pickers use an office-maintained all-India seed (and free-text “Other” entries). Client address uses a separate locations seed. This portal does not scrape or republish the Government of India eCourts portals (services.ecourts.gov.in / ecourts.gov.in) and does not call third-party court-data APIs for the case register.",
          "Court names entered here are for internal case-register convenience only. Staff must verify CNR, cause list, and filings against official court / eCourts records before relying on them.",
        ],
      },
      {
        heading: "9. Contact",
        paragraphs: [
          `Office: ${office.addressLines.join(", ")}.`,
          `Phone: ${office.contactPhone}. Email: ${office.contactEmail}.`,
        ],
      },
    ],
  },
  {
    slug: "consultation-policy",
    title: "Consultation policy",
    updatedAt: "2026-07-23",
    intro: `How ${brand.name} handles first meetings, appointments, and what a consultation includes before a case is registered.`,
    sections: [
      {
        heading: "1. Booking",
        paragraphs: [
          "Consultations are booked through the office appointments diary (office / phone / video). Walk-ins are subject to advocate availability.",
          "Please bring any notice, FIR copy, petition, order, contract, or ID you already have. Incomplete papers may limit advice.",
        ],
      },
      {
        heading: "2. What a consultation covers",
        paragraphs: [
          "A consultation is a preliminary discussion of facts and options. It may include: whether court action is suitable, likely forums (district / high court / tribunal), rough stages, and documents still needed.",
          "It does not include drafting or filing until separately agreed. Urgent interim relief needs express confirmation from the assigned advocate.",
        ],
      },
      {
        heading: "3. Consultation fee",
        paragraphs: [
          "A consultation fee may apply (fixed or time-based) as told at booking. Fee paid for consultation is generally non-refundable once the meeting has started, unless the office cancels.",
          "If the matter is taken up, consultation fee may be adjusted against the brief/advance only if the advocate confirms that in writing or on the cash receipt.",
        ],
      },
      {
        heading: "4. After consultation — case register",
        paragraphs: [
          "If you engage the office, staff will open a Client (CLI) and Case register entry (CSE) with: State → District → Court, case type, parties, advocate on record, and optional CNR / court number when available.",
          "Hearing dates and SMS reminders use the primary mobile recorded at intake — keep it updated.",
        ],
      },
      {
        heading: "5. Cancellation / no-show",
        paragraphs: [
          "Please cancel at least a few hours before the slot so another client can use it. Repeated no-shows may require advance payment for the next booking.",
        ],
      },
      {
        heading: "6. Conflict and refusal",
        paragraphs: [
          "The office may decline or withdraw if there is a conflict of interest, incomplete disclosure, abusive conduct, or instructions contrary to law or professional ethics.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy & data practice",
    updatedAt: "2026-07-23",
    intro: `How ${brand.name} handles personal data of clients and staff in this portal.`,
    sections: [
      {
        heading: "1. What we collect",
        paragraphs: [
          "Client intake may include name, parent/spouse name, mobile, alternate mobile, email, address, city, district, state, occupation, matter brief, and notes needed for the case.",
          "Case files may include court location, case type, opposing party, CNR, hearings, uploaded PDFs/images (judgments, orders, pleadings), and payment records.",
        ],
      },
      {
        heading: "2. Why we collect it",
        paragraphs: [
          "To maintain the office case register, contact you for hearings, issue receipts, assign advocates, and meet professional record-keeping needs.",
          "SMS to the registered mobile may be used for hearing reminders when enabled.",
        ],
      },
      {
        heading: "3. Storage and access",
        paragraphs: [
          "Data is stored in the office database and file storage with role-based access (admin, advocate, staff, accountant as configured).",
          "Do not upload full Aadhaar card images unless the advocate specifically requires a copy for filing — prefer redacted copies.",
        ],
      },
      {
        heading: "4. Sharing",
        paragraphs: [
          "We do not sell client data. Sharing is limited to: courts/authorities when filing, co-counsel with client knowledge, SMS/email providers for operational messages, and legal compulsion.",
        ],
      },
      {
        heading: "5. Retention",
        paragraphs: [
          "Case records are retained as long as needed for the matter and office archive practice. Staff accounts follow HR deactivation rules.",
        ],
      },
      {
        heading: "6. Your requests",
        paragraphs: [
          `To correct contact details or ask about your file, contact the office at ${office.contactPhone} / ${office.contactEmail} with your CLI or CSE id.`,
        ],
      },
    ],
  },
];

export function getLegalPage(slug: string): LegalPage | undefined {
  return legalPages.find((p) => p.slug === slug);
}
