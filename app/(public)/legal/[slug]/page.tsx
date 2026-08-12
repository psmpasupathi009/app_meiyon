import Link from "next/link";
import { notFound } from "next/navigation";

import { legalPages, type LegalPage } from "@/config/company/legal";

export function generateStaticParams() {
  return legalPages.map((page) => ({ slug: page.slug }));
}

function getPage(slug: string): LegalPage | undefined {
  return legalPages.find((p) => p.slug === slug);
}

const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";

const platformLegal = [
  { href: `${MARKETING_URL}/legal/terms`, label: "Platform Terms" },
  { href: `${MARKETING_URL}/legal/privacy`, label: "Platform Privacy" },
  { href: `${MARKETING_URL}/legal/refund-policy`, label: "Refund Policy" },
  { href: `${MARKETING_URL}/legal/dpa`, label: "Data Processing Agreement" },
];

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-brand">Office policies</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
        {page.title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated {page.updatedAt}</p>
      <p className="mt-6 text-zinc-600">{page.intro}</p>

      <div className="mt-10 space-y-8">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-zinc-900">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600">
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Platform terms (MEIYON)</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Software subscription and data processing terms with PSM Softwares.
        </p>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm">
          {platformLegal.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-brand underline hover:text-navy"
                target="_blank"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
