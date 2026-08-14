import { brand } from "@/config/company/brand";

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

const MARKETING =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";

/**
 * Platform SaaS policies for every tenant. Chamber-specific engagement /
 * vakalatnama rules are not published here (optional later per office).
 */
export const legalPages: LegalPage[] = [
  {
    slug: "terms",
    title: "Terms of use",
    updatedAt: "2026-08-14",
    intro: `These terms govern use of the ${brand.name} office portal, practice-management software operated by PSM Softwares. Full platform terms are published at ${MARKETING}/legal/terms.`,
    sections: [
      {
        heading: "1. Software, not a law firm",
        paragraphs: [
          "MEIYON is practice-management software. PSM Softwares is not a law firm, does not provide legal advice, and does not solicit legal work (BCI Rule 36).",
          "Your office remains responsible for client engagement, vakalatnama, and professional conduct.",
        ],
      },
      {
        heading: "2. Access and billing",
        paragraphs: [
          "Access is provisioned by Super Admin. Trials are 7 days with no auto-charge, then 7 days past-due grace, then a billing pay-wall until you subscribe.",
          "Office admins manage payment on Billing. Cancellation takes effect at period end.",
        ],
      },
      {
        heading: "3. Acceptable use",
        paragraphs: [
          "Do not share PIN/OTP. Do not use the portal to solicit legal work or publish advocate advertisements.",
          "Misuse of client data may lead to account deactivation.",
        ],
      },
    ],
  },
  {
    slug: "consultation-policy",
    title: "Consultation policy",
    updatedAt: "2026-08-14",
    intro:
      "This page covers SaaS onboarding with MEIYON, not a vakalatnama or advocate consultation. Legal meetings are solely between the client and the law office that uses this software.",
    sections: [
      {
        heading: "1. Platform onboarding",
        paragraphs: [
          "A marketing-site trial request is a request for software access. It does not create an attorney-client relationship with PSM Softwares.",
          "Appointments booked in this portal are with the tenant office, not with MEIYON.",
        ],
      },
      {
        heading: "2. Office responsibility",
        paragraphs: [
          "Each office sets its own consultation fees, conflict checks, and engagement letters.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    updatedAt: "2026-08-14",
    intro: `How ${brand.name} (PSM Softwares) processes personal data in this portal. Platform DPDP notice: ${MARKETING}/legal/privacy. Data Processing Agreement: ${MARKETING}/legal/dpa.`,
    sections: [
      {
        heading: "1. Roles",
        paragraphs: [
          "The law office is the Data Fiduciary for client and staff files. PSM Softwares is the Data Processor for that data, and a Data Fiduciary for platform accounts and marketing leads.",
        ],
      },
      {
        heading: "2. Storage",
        paragraphs: [
          "Data is stored in MongoDB Atlas. Files are hosted on Cloudinary; the database stores only the file URL and metadata. Payments via Razorpay. OTP and hearing SMS via 2Factor when configured.",
        ],
      },
      {
        heading: "3. SMS",
        paragraphs: [
          "Hearing reminders are sent only with client SMS consent (off by default) and a DLT-registered template. OTP uses a separate registered template.",
        ],
      },
      {
        heading: "4. Rights and grievance",
        paragraphs: [
          `For access, correction, erasure, or complaints, email hello@meiyon.com or see ${MARKETING}/legal/grievance.`,
        ],
      },
    ],
  },
];

export function getLegalPage(slug: string): LegalPage | undefined {
  return legalPages.find((p) => p.slug === slug);
}
