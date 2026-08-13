#!/usr/bin/env tsx
/**
 * MEIYON 3-site smoke: marketing → PSM Admin OTP/PIN → office invite → portal OTP/PIN.
 * Run from app_meiyon: npm run smoke
 */
import { prisma } from "@meiyon/db";

const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3002";
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";
const LEAD_SECRET = process.env.LEAD_INGEST_SECRET?.trim();
const ADMIN_MOBILE = process.env.ADMIN_MOBILE?.trim() ?? "";
const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || "482917";
const OFFICE_PIN = "258369";
const OFFICE_PIN_RESET = "369258";
const LOCAL_OTP = "0000";

let failed = 0;

function ok(msg: string) {
  console.log(`✓ ${msg}`);
}
function fail(msg: string) {
  console.error(`✗ ${msg}`);
  failed += 1;
}

type CookieJar = Map<string, string>;

function collectCookies(res: Response, jar: CookieJar) {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const c of raw) {
    const nv = c.split(";")[0];
    const eq = nv.indexOf("=");
    if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
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

async function jsonPost(
  url: string,
  body: unknown,
  jar?: CookieJar
): Promise<{ status: number; json: Record<string, unknown>; res: Response }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jar && jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  if (jar) collectCookies(res, jar);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json, res };
}

async function getPage(url: string, jar?: CookieJar) {
  return fetch(url, {
    redirect: "manual",
    headers: jar && jar.size ? { Cookie: cookieHeader(jar) } : {},
  });
}

function dataOf(json: Record<string, unknown>): Record<string, unknown> {
  return (json.data as Record<string, unknown> | undefined) ?? json;
}

async function adminSession(mobile: string): Promise<CookieJar | null> {
  const jar: CookieJar = new Map();
  const check = await jsonPost(`${ADMIN}/api/auth/check-mobile`, { mobile });
  const data = dataOf(check.json);
  if (check.status >= 500 || !check.json.ok) {
    fail(`SA check-mobile → ${check.status} ${JSON.stringify(check.json)}`);
    return null;
  }

  if (data.status === "otp_required") {
    if (!data.otpPending) {
      const sent = await jsonPost(`${ADMIN}/api/auth/send-otp`, {
        mobile,
        purpose: "setup",
      });
      if (!sent.json.ok) {
        fail(`SA send-otp → ${sent.status} ${JSON.stringify(sent.json)}`);
        return null;
      }
    }
    const verify = await jsonPost(`${ADMIN}/api/auth/verify-otp`, {
      mobile,
      otp: LOCAL_OTP,
      purpose: "setup",
    });
    const proof = dataOf(verify.json).otpProofToken;
    if (!verify.json.ok || typeof proof !== "string") {
      fail(`SA verify-otp → ${verify.status} ${JSON.stringify(verify.json)}`);
      return null;
    }
    const setup = await jsonPost(
      `${ADMIN}/api/auth/setup-pin`,
      { pin: ADMIN_PIN, confirmPin: ADMIN_PIN, otpProofToken: proof },
      jar
    );
    if (!setup.json.ok) {
      fail(`SA setup-pin → ${setup.status} ${JSON.stringify(setup.json)}`);
      return null;
    }
    ok("SA OTP → setup-pin cookie");
    return jar;
  }

  if (data.status === "pin") {
    const login = await jsonPost(
      `${ADMIN}/api/auth/login`,
      { mobile, pin: ADMIN_PIN },
      jar
    );
    if (login.json.ok) {
      ok("SA PIN login cookie");
      return jar;
    }
    const sent = await jsonPost(`${ADMIN}/api/auth/send-otp`, {
      mobile,
      purpose: "forgot_pin",
    });
    if (!sent.json.ok) {
      fail(`SA forgot send-otp → ${sent.status} ${JSON.stringify(sent.json)}`);
      return null;
    }
    const verify = await jsonPost(`${ADMIN}/api/auth/verify-otp`, {
      mobile,
      otp: LOCAL_OTP,
      purpose: "forgot_pin",
    });
    const proof = dataOf(verify.json).otpProofToken;
    if (!verify.json.ok || typeof proof !== "string") {
      fail(`SA forgot verify-otp → ${verify.status} ${JSON.stringify(verify.json)}`);
      return null;
    }
    const reset = await jsonPost(
      `${ADMIN}/api/auth/forgot-pin/reset`,
      { pin: ADMIN_PIN, confirmPin: ADMIN_PIN, otpProofToken: proof },
      jar
    );
    if (!reset.json.ok) {
      fail(`SA forgot-PIN reset → ${reset.status} ${JSON.stringify(reset.json)}`);
      return null;
    }
    ok("SA forgot-PIN reset cookie");
    return jar;
  }

  fail(`SA check-mobile unexpected ${JSON.stringify(data)}`);
  return null;
}

async function main() {
  console.log("MEIYON 3-site smoke\n");

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

  if (process.env.OTP_LIVE === "1") {
    console.warn("⚠ OTP_LIVE=1 — smoke expects live 2Factor, not local 0000");
  } else {
    ok("OTP_LIVE unset (local OTP 0000)");
  }

  try {
    await prisma.$connect();
    const [offices, plans, platformUsers, leads, products] = await Promise.all([
      prisma.office.count(),
      prisma.plan.count(),
      prisma.platformUser.count(),
      prisma.lead.count(),
      prisma.product.count(),
    ]);
    ok(
      `DB connected — ${offices} offices, ${plans} plans, ${platformUsers} platform users, ${leads} leads, ${products} products`
    );
    if (plans < 1) fail("No plans seeded — run npm run db:seed");
    if (platformUsers < 1) fail("No platform users — run npm run db:seed");
    if (products < 1) fail("No products seeded — run npm run db:seed");
  } catch (e) {
    fail(`DB connection failed: ${e instanceof Error ? e.message : e}`);
    fail("Allowlist this machine in Atlas Network Access, then run npm run db:push && npm run db:seed");
  }

  console.log("\nHTTP checks:");
  await checkUrl("Marketing", MARKETING);
  await checkUrl("Marketing /contact", `${MARKETING}/contact`);
  await checkUrl("PSM Admin /login", `${ADMIN}/login`);
  await checkUrl("Office Portal /login", `${PORTAL}/login`);

  const unauthAdmin = await getPage(`${ADMIN}/meiyon`);
  if (unauthAdmin.status === 307 || unauthAdmin.status === 302) {
    ok(`SA unauth /meiyon → ${unauthAdmin.status}`);
  } else {
    fail(`SA unauth /meiyon expected redirect, got ${unauthAdmin.status}`);
  }
  const unauthPortal = await getPage(`${PORTAL}/clients`);
  if (unauthPortal.status === 307 || unauthPortal.status === 302) {
    ok(`OP unauth /clients → ${unauthPortal.status}`);
  } else {
    fail(`OP unauth /clients expected redirect, got ${unauthPortal.status}`);
  }

  console.log("\nFlow: marketing contact + lead ingest:");
  {
    const bad = await fetch(`${MARKETING}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", mobile: "123" }),
    });
    if (bad.status === 400) ok("Marketing invalid contact → 400");
    else fail(`Marketing invalid contact → ${bad.status}`);
  }

  const stamp = String(Date.now());
  const contactMobile = `8${stamp.slice(-9)}`;
  const officeMobile = `7${stamp.slice(-9)}`;
  let contactLeadId: string | null = null;

  {
    const res = await fetch(`${MARKETING}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Contact Smoke",
        firmName: "Contact Firm",
        mobile: contactMobile,
        email: "contact-smoke@example.com",
        city: "Madurai",
        message: "Please call us about MEIYON trial",
        planInterest: "professional",
        acceptTerms: true,
      }),
    });
    if (res.ok) ok(`Marketing contact → ${res.status}`);
    else fail(`Marketing contact → ${res.status} ${await res.text()}`);

    const lead = await prisma.lead.findFirst({
      where: { mobile: `91${contactMobile}` },
      orderBy: { createdAt: "desc" },
    });
    if (lead) {
      contactLeadId = lead.id;
      ok(`Lead in DB ${lead.id} mobile=${lead.mobile}`);
    } else {
      fail("Contact lead not found in DB (expected 91… mobile)");
    }
  }

  if (!LEAD_SECRET) {
    fail("LEAD_INGEST_SECRET missing — marketing→admin leads will fail");
  } else {
    const mobile = `9${stamp.slice(-9)}`;
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

  console.log("\nFlow: PSM Admin auth:");
  if (!ADMIN_MOBILE) {
    fail("ADMIN_MOBILE missing — skip admin/portal loop");
    console.log(failed ? `\nDone with ${failed} failure(s).` : "\nAll smoke checks passed.");
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  }

  const saJar = await adminSession(ADMIN_MOBILE.replace(/\D/g, "").length === 10
    ? ADMIN_MOBILE.replace(/\D/g, "")
    : ADMIN_MOBILE);
  if (!saJar) {
    console.log(failed ? `\nDone with ${failed} failure(s).` : "\nAll smoke checks passed.");
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  }

  const saHome = await getPage(`${ADMIN}/`, saJar);
  const saMeiyon = await getPage(`${ADMIN}/meiyon`, saJar);
  if (saHome.status === 200) ok("SA / → 200");
  else fail(`SA / → ${saHome.status}`);
  if (saMeiyon.status === 200) ok("SA /meiyon → 200");
  else fail(`SA /meiyon → ${saMeiyon.status}`);

  console.log("\nFlow: create office + invite OTP:");
  const slug = `smoke-${stamp}`;
  const create = await jsonPost(
    `${ADMIN}/api/offices`,
    {
      name: `Smoke Office ${stamp.slice(-6)}`,
      slug,
      adminMobile: officeMobile,
      adminName: "Smoke Admin",
      planCode: "starter",
      leadId: contactLeadId || undefined,
    },
    saJar
  );
  const created = dataOf(create.json);
  const office = created.office as { unitId?: string } | undefined;
  const invite = created.invite as
    | { inviteSent?: boolean; bypassed?: boolean }
    | undefined;
  if (!create.json.ok || !office?.unitId) {
    fail(`Create office → ${create.status} ${JSON.stringify(create.json)}`);
  } else {
    ok(`Create office ${office.unitId}`);
    if (invite?.inviteSent) ok("Office invite OTP sent (session persisted)");
    else fail(`Office invite not sent ${JSON.stringify(invite)}`);
    if (created.portalLoginUrl) ok(`portalLoginUrl ${created.portalLoginUrl}`);
    else fail("portalLoginUrl missing");
  }

  const otpSession = await prisma.otpSession.findFirst({
    where: { mobile: `91${officeMobile}`, purpose: "setup", expiresAt: { gt: new Date() } },
  });
  if (otpSession) ok("Portal otpSession purpose=setup exists");
  else fail("Portal otpSession missing after office create");

  if (contactLeadId) {
    const lead = await prisma.lead.findUnique({ where: { id: contactLeadId } });
    if (lead?.status === "converted") ok("Lead status converted");
    else fail(`Lead status ${lead?.status ?? "missing"}, expected converted`);
  }

  console.log("\nFlow: portal OTP → PIN:");
  const opCheck = await jsonPost(`${PORTAL}/api/auth/check-mobile`, {
    mobile: officeMobile,
  });
  const opData = dataOf(opCheck.json);
  if (
    opCheck.json.ok &&
    opData.status === "otp_required" &&
    opData.otpPending === true
  ) {
    ok("OP check-mobile otp_required + otpPending");
  } else {
    fail(`OP check-mobile expected otpPending, got ${JSON.stringify(opCheck.json)}`);
  }

  const opJar: CookieJar = new Map();
  const opVerify = await jsonPost(`${PORTAL}/api/auth/verify-otp`, {
    mobile: officeMobile,
    otp: LOCAL_OTP,
    purpose: "setup",
    officeUnitId: opData.officeUnitId,
  });
  const opProof = dataOf(opVerify.json).otpProofToken;
  if (!opVerify.json.ok || typeof opProof !== "string") {
    fail(`OP verify-otp → ${opVerify.status} ${JSON.stringify(opVerify.json)}`);
  } else {
    ok("OP verify-otp");
    const opSetup = await jsonPost(
      `${PORTAL}/api/auth/setup-pin`,
      {
        pin: OFFICE_PIN,
        confirmPin: OFFICE_PIN,
        otpProofToken: opProof,
        officeUnitId: opData.officeUnitId,
      },
      opJar
    );
    if (!opSetup.json.ok) {
      fail(`OP setup-pin → ${opSetup.status} ${JSON.stringify(opSetup.json)}`);
    } else {
      ok("OP setup-pin cookie");
    }
  }

  for (const path of ["/", "/clients", "/cases", "/diary"]) {
    const res = await getPage(`${PORTAL}${path}`, opJar);
    if (res.status === 200) ok(`OP ${path} → 200`);
    else fail(`OP ${path} → ${res.status}`);
  }

  const casesApi = await fetch(`${PORTAL}/api/cases`, {
    headers: { Cookie: cookieHeader(opJar) },
  });
  const casesJson = (await casesApi.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: unknown[];
  };
  if (casesApi.ok && casesJson.ok && Array.isArray(casesJson.data)) {
    ok(`OP /api/cases scoped list (${casesJson.data.length} rows)`);
  } else {
    fail(`OP /api/cases → ${casesApi.status} ${JSON.stringify(casesJson)}`);
  }

  const diaryApi = await fetch(`${PORTAL}/api/diary`, {
    headers: { Cookie: cookieHeader(opJar) },
  });
  const diaryJson = (await diaryApi.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { items?: unknown[]; appointments?: unknown[]; tasks?: unknown[] };
  };
  if (diaryApi.ok && diaryJson.ok) {
    const items = diaryJson.data?.items?.length ?? 0;
    const appts = diaryJson.data?.appointments?.length ?? 0;
    const tasks = diaryJson.data?.tasks?.length ?? 0;
    ok(`OP /api/diary scoped (${items} hearings, ${appts} appts, ${tasks} tasks)`);
  } else {
    fail(`OP /api/diary → ${diaryApi.status} ${JSON.stringify(diaryJson)}`);
  }

  console.log("\nFlow: PIN re-login:");
  const saRelogin = await jsonPost(`${ADMIN}/api/auth/login`, {
    mobile: ADMIN_MOBILE,
    pin: ADMIN_PIN,
  });
  if (saRelogin.json.ok) ok("SA PIN re-login");
  else fail(`SA PIN re-login → ${saRelogin.status} ${JSON.stringify(saRelogin.json)}`);

  const opReloginJar: CookieJar = new Map();
  const opRelogin = await jsonPost(
    `${PORTAL}/api/auth/login`,
    { mobile: officeMobile, pin: OFFICE_PIN, officeUnitId: opData.officeUnitId },
    opReloginJar
  );
  if (opRelogin.json.ok) ok("OP PIN re-login");
  else fail(`OP PIN re-login → ${opRelogin.status} ${JSON.stringify(opRelogin.json)}`);

  console.log("\nFlow: portal forgot-PIN:");
  const forgotSend = await jsonPost(`${PORTAL}/api/auth/send-otp`, {
    mobile: officeMobile,
    purpose: "forgot_pin",
    officeUnitId: opData.officeUnitId,
  });
  if (!forgotSend.json.ok) {
    fail(`OP forgot send-otp → ${forgotSend.status} ${JSON.stringify(forgotSend.json)}`);
  } else {
    const forgotVerify = await jsonPost(`${PORTAL}/api/auth/verify-otp`, {
      mobile: officeMobile,
      otp: LOCAL_OTP,
      purpose: "forgot_pin",
      officeUnitId: opData.officeUnitId,
    });
    const forgotProof = dataOf(forgotVerify.json).otpProofToken;
    if (!forgotVerify.json.ok || typeof forgotProof !== "string") {
      fail(`OP forgot verify → ${forgotVerify.status} ${JSON.stringify(forgotVerify.json)}`);
    } else {
      const resetJar: CookieJar = new Map();
      const reset = await jsonPost(
        `${PORTAL}/api/auth/forgot-pin/reset`,
        {
          pin: OFFICE_PIN_RESET,
          confirmPin: OFFICE_PIN_RESET,
          otpProofToken: forgotProof,
          officeUnitId: opData.officeUnitId,
        },
        resetJar
      );
      if (reset.json.ok) ok("OP forgot-PIN reset + cookie");
      else fail(`OP forgot-PIN reset → ${reset.status} ${JSON.stringify(reset.json)}`);
    }
  }

  console.log(failed ? `\nDone with ${failed} failure(s).` : "\nAll smoke checks passed.");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
