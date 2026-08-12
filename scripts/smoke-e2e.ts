#!/usr/bin/env tsx
/**
 * MEIYON product smoke — env, DB, HTTP, contact→lead, auth check-mobile.
 * Run from app_meiyon: npm run smoke
 */
import { prisma } from "@meiyon/db";

const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3002";
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";
const LEAD_SECRET = process.env.LEAD_INGEST_SECRET?.trim();
const ADMIN_MOBILE = process.env.ADMIN_MOBILE?.trim();

let failed = 0;

function ok(msg: string) {
  console.log(`✓ ${msg}`);
}
function fail(msg: string) {
  console.error(`✗ ${msg}`);
  failed += 1;
}

async function checkUrl(name: string, url: string, expectOk = true) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (expectOk && res.status >= 500) {
      fail(`${name} ${url} → ${res.status}`);
      return false;
    }
    ok(`${name} ${url} → ${res.status}`);
    return true;
  } catch {
    fail(`${name} ${url} unreachable`);
    return false;
  }
}

async function main() {
  console.log("MEIYON product smoke\n");

  const required = ["DATABASE_URL", "JWT_SECRET_OP", "JWT_SECRET_SA", "ADMIN_MOBILE"];
  for (const key of required) {
    if (!process.env[key]) fail(`Missing ${key}`);
    else ok(`${key} set`);
  }

  if (process.env.JWT_SECRET_OP === process.env.JWT_SECRET_SA) {
    fail("JWT_SECRET_OP and JWT_SECRET_SA must differ");
  } else {
    ok("JWT secrets are distinct");
  }

  if (process.env.OTP_DEV_BYPASS === "1") {
    ok("OTP_DEV_BYPASS=1 (local OTP 0000)");
  } else {
    console.warn("⚠ OTP_DEV_BYPASS not set — live 2Factor required for OTP");
  }

  try {
    await prisma.$connect();
    const [offices, plans, platformUsers, leads] = await Promise.all([
      prisma.office.count(),
      prisma.plan.count(),
      prisma.platformUser.count(),
      prisma.lead.count(),
    ]);
    ok(`DB connected — ${offices} offices, ${plans} plans, ${platformUsers} platform users, ${leads} leads`);
    if (plans < 1) fail("No plans seeded — run npm run db:seed");
    if (platformUsers < 1) fail("No platform users — run npm run db:seed");
  } catch (e) {
    fail(`DB connection failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  console.log("\nHTTP checks:");
  await checkUrl("Marketing", MARKETING);
  await checkUrl("Marketing /contact", `${MARKETING}/contact`);
  await checkUrl("Super Admin /login", `${ADMIN}/login`);
  await checkUrl("Office Portal /login", `${PORTAL}/login`);

  console.log("\nFlow: lead ingest (admin API):");
  if (!LEAD_SECRET) {
    fail("LEAD_INGEST_SECRET missing — marketing→admin leads will fail");
  } else {
    const mobile = `9${String(Date.now()).slice(-9)}`;
    const res = await fetch(`${ADMIN}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LEAD_SECRET}`,
      },
      body: JSON.stringify({
        name: "Smoke Tester",
        firmName: "Smoke Firm",
        mobile,
        email: "smoke@example.com",
        city: "Chennai",
        message: "Smoke lead from product test",
        planInterest: "starter",
      }),
    });
    if (res.ok) ok(`Admin lead ingest → ${res.status}`);
    else fail(`Admin lead ingest → ${res.status} ${await res.text()}`);
  }

  console.log("\nFlow: marketing contact → admin:");
  {
    const mobile = `8${String(Date.now()).slice(-9)}`;
    const res = await fetch(`${MARKETING}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Contact Smoke",
        firmName: "Contact Firm",
        mobile,
        email: "contact-smoke@example.com",
        city: "Madurai",
        message: "Please call us about MEIYON trial",
        planInterest: "professional",
        acceptTerms: true,
      }),
    });
    if (res.ok) ok(`Marketing contact → ${res.status}`);
    else fail(`Marketing contact → ${res.status} ${await res.text()}`);
  }

  console.log("\nFlow: auth check-mobile:");
  if (ADMIN_MOBILE) {
    const sa = await fetch(`${ADMIN}/api/auth/check-mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: ADMIN_MOBILE }),
    });
    const saBody = await sa.json().catch(() => ({}));
    if (sa.ok) ok(`SA check-mobile ${ADMIN_MOBILE} → ${sa.status} ${JSON.stringify(saBody?.data ?? saBody)}`);
    else fail(`SA check-mobile → ${sa.status} ${JSON.stringify(saBody)}`);

    const op = await fetch(`${PORTAL}/api/auth/check-mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: ADMIN_MOBILE }),
    });
    const opBody = await op.json().catch(() => ({}));
    // Admin mobile may or may not be an office user — either 200 with offices or not-found is fine if API works
    if (op.status < 500) ok(`OP check-mobile → ${op.status}`);
    else fail(`OP check-mobile → ${op.status} ${JSON.stringify(opBody)}`);
  }

  console.log(failed ? `\nDone with ${failed} failure(s).` : "\nAll smoke checks passed.");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
