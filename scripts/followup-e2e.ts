#!/usr/bin/env tsx
/**
 * Fill holes the main smoke script skips: client/case/hearing, client invite,
 * Cloudinary upload, Razorpay checkout, SA extend/suspend, marketing extras.
 */
import { prisma } from "@meiyon/db";

const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3002";
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000";
const ADMIN_MOBILE = (process.env.ADMIN_MOBILE ?? "").replace(/\D/g, "");
const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || "482917";
const OFFICE_PIN = "369258";
const CLIENT_PIN = "258147";
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
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const nv = c.split(";")[0];
    const eq = nv.indexOf("=");
    if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
  }
}
function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function dataOf(json: Record<string, unknown>) {
  return (json.data as Record<string, unknown> | undefined) ?? json;
}
async function jsonPost(url: string, body: unknown, jar?: CookieJar) {
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
async function jsonPatch(url: string, body: unknown, jar: CookieJar) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  collectCookies(res, jar);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}
async function jsonGet(url: string, jar: CookieJar) {
  const res = await fetch(url, { headers: { Cookie: cookieHeader(jar) }, redirect: "manual" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json, res };
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  console.log("MEIYON follow-up (holes smoke skipped)\n");

  console.log("A. Marketing extras:");
  for (const path of [
    "/",
    "/features",
    "/pricing",
    "/how-it-works",
    "/security",
    "/contact",
    "/legal/terms",
    "/legal/privacy",
    "/legal/consultation-policy",
    "/legal/refund-policy",
    "/legal/gst-tax",
    "/legal/sla",
    "/legal/cookie-policy",
    "/legal/dpa",
    "/legal/grievance",
  ]) {
    const res = await fetch(`${MARKETING}${path}`, { redirect: "manual" });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const jwtish = setCookie.some((c) => /jwt|access|session|meiyon_/i.test(c));
    if (res.status === 200) ok(`${path} → 200`);
    else fail(`${path} → ${res.status}`);
    if (jwtish) fail(`${path} set auth cookie: ${setCookie.join(" | ")}`);
  }
  {
    const home = await fetch(`${MARKETING}/`);
    const html = await home.text();
    if (html.includes("http://localhost:3002/login")) ok("Header Login → :3002/login");
    else fail("Header Login link missing :3002/login");
    if (html.includes("http://localhost:3001/login")) ok("Footer Platform admin → :3001/login");
    else fail("Footer admin link missing :3001/login");
    if (html.includes("14-day") || html.includes("14 day")) fail("14-day leftover on home");
    else ok("No 14-day on home");
    if (html.includes("tenant isolation")) ok("Home tenant isolation copy");
    else fail("Home missing tenant isolation");
  }
  {
    const res = await fetch(`${MARKETING}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = (await res.json()) as { fieldErrors?: unknown };
    if (res.status === 400 && json.fieldErrors) ok("Invalid contact fieldErrors");
    else fail(`Invalid contact → ${res.status}`);
  }

  console.log("\nSamples (portal public):");
  for (const f of [
    "clients.sample.csv",
    "cases.sample.csv",
    "hearings.sample.csv",
    "payments.sample.csv",
    "employees.sample.csv",
    "dak.sample.csv",
    "tasks.sample.csv",
    "appointments.sample.csv",
  ]) {
    const res = await fetch(`${PORTAL}/samples/${f}`, { redirect: "manual" });
    if (res.status === 200) ok(`/samples/${f} → 200`);
    else fail(`/samples/${f} → ${res.status}`);
  }

  const office = await prisma.office.findUnique({ where: { unitId: "OFF-00006" } });
  if (!office) {
    fail("OFF-00006 missing — run smoke first");
    await prisma.$disconnect();
    process.exit(1);
  }
  const admin = await prisma.user.findFirst({
    where: { officeId: office.id, roles: { has: "admin" } },
  });
  if (!admin) {
    fail("Office admin missing");
    await prisma.$disconnect();
    process.exit(1);
  }
  const admin10 = admin.mobile.replace(/^91/, "");
  ok(`Office ${office.unitId} admin mobile …${admin10.slice(-4)}`);

  console.log("\nC. Portal staff login + client/case/hearing:");
  const opJar: CookieJar = new Map();
  const login = await jsonPost(
    `${PORTAL}/api/auth/login`,
    { mobile: admin10, pin: OFFICE_PIN, officeUnitId: office.unitId },
    opJar
  );
  if (!login.json.ok) {
    fail(`OP login → ${login.status} ${JSON.stringify(login.json)}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  ok("OP staff PIN login");
  if (opJar.has("meiyon_op_access")) ok("cookie meiyon_op_access");
  else fail(`missing meiyon_op_access (got ${[...opJar.keys()].join(",")})`);

  const stamp = String(Date.now());
  const clientMobile = `6${stamp.slice(-9)}`;
  const clientCreate = await jsonPost(
    `${PORTAL}/api/clients`,
    {
      name: "Live Test Client",
      mobile: clientMobile,
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      smsConsent: false,
    },
    opJar
  );
  const clientData = dataOf(clientCreate.json);
  const client = (clientData.client ?? clientData) as { unitId?: string };
  if (!clientCreate.json.ok || !client.unitId) {
    fail(`Create client → ${clientCreate.status} ${JSON.stringify(clientCreate.json)}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  ok(`Client ${client.unitId}`);

  const caseCreate = await jsonPost(
    `${PORTAL}/api/cases`,
    {
      clientUnitId: client.unitId,
      caseNumber: `CS/${stamp.slice(-6)}/2026`,
      state: "Tamil Nadu",
      district: "Madurai",
      city: "Madurai",
      courtName: "Madurai Bench of Madras High Court",
      caseType: "CS",
      primaryAdvocateMobile: admin10,
      status: "active",
    },
    opJar
  );
  const caseData = dataOf(caseCreate.json);
  const cse = (caseData.case ?? caseData) as { unitId?: string };
  if (!caseCreate.json.ok || !cse.unitId) {
    fail(`Create case → ${caseCreate.status} ${JSON.stringify(caseCreate.json)}`);
  } else {
    ok(`Case ${cse.unitId}`);
  }

  const hearingDate = new Date();
  hearingDate.setDate(hearingDate.getDate() + 1);
  const hearingIso = hearingDate.toISOString();
  if (cse.unitId) {
    const hearing = await jsonPost(
      `${PORTAL}/api/cases/${cse.unitId}/hearings`,
      { hearingDate: hearingIso, purpose: "For appearance", notes: "Live E2E" },
      opJar
    );
    if (hearing.json.ok) ok("Hearing created");
    else fail(`Hearing → ${hearing.status} ${JSON.stringify(hearing.json)}`);
  }

  const diary = await jsonGet(
    `${PORTAL}/api/diary?date=${hearingIso.slice(0, 10)}`,
    opJar
  );
  const diaryData = dataOf(diary.json) as { items?: unknown[] };
  const n = diaryData.items?.length ?? 0;
  if (diary.status === 200 && n >= 1) ok(`Diary shows hearing (${n})`);
  else fail(`Diary → ${diary.status} items=${n} ${JSON.stringify(diary.json).slice(0, 300)}`);

  console.log("\nC5. Invite client + client-only scope:");
  const invite = await jsonPost(
    `${PORTAL}/api/clients/${client.unitId}/portal-access`,
    {},
    opJar
  );
  const inviteData = dataOf(invite.json) as {
    invite?: { inviteSent?: boolean };
    message?: string;
  };
  if (invite.json.ok && inviteData.invite?.inviteSent) ok("Client portal invite OTP sent");
  else fail(`Client invite → ${invite.status} ${JSON.stringify(invite.json)}`);

  const clientCheck = await jsonPost(`${PORTAL}/api/auth/check-mobile`, {
    mobile: clientMobile,
  });
  const clientCheckData = dataOf(clientCheck.json);
  if (clientCheck.json.ok && clientCheckData.status === "otp_required") {
    ok("Client check-mobile otp_required");
  } else {
    fail(`Client check-mobile → ${JSON.stringify(clientCheck.json)}`);
  }

  const clientJar: CookieJar = new Map();
  const clientVerify = await jsonPost(`${PORTAL}/api/auth/verify-otp`, {
    mobile: clientMobile,
    otp: LOCAL_OTP,
    purpose: "setup",
    officeUnitId: office.unitId,
  });
  const proof = dataOf(clientVerify.json).otpProofToken;
  if (typeof proof !== "string") {
    fail(`Client verify-otp → ${JSON.stringify(clientVerify.json)}`);
  } else {
    const setup = await jsonPost(
      `${PORTAL}/api/auth/setup-pin`,
      {
        pin: CLIENT_PIN,
        confirmPin: CLIENT_PIN,
        otpProofToken: proof,
        officeUnitId: office.unitId,
      },
      clientJar
    );
    if (setup.json.ok) ok("Client setup-pin cookie");
    else fail(`Client setup-pin → ${JSON.stringify(setup.json)}`);
  }

  const clientCases = await jsonGet(`${PORTAL}/api/cases`, clientJar);
  const clientCasesData = clientCases.json as { ok?: boolean; data?: { unitId?: string }[] };
  const rows = clientCasesData.data ?? [];
  if (clientCases.status === 200 && rows.length === 1 && rows[0]?.unitId === cse.unitId) {
    ok(`Client sees only own case (${rows[0]?.unitId})`);
  } else {
    fail(`Client cases → ${clientCases.status} n=${rows.length} ${JSON.stringify(clientCases.json).slice(0, 250)}`);
  }

  const clientClients = await jsonGet(`${PORTAL}/api/clients`, clientJar);
  if (clientClients.status === 403 || clientClients.status === 404) {
    ok(`Client blocked from staff /api/clients (${clientClients.status})`);
  } else if (clientClients.status === 200) {
    fail("Client can list all clients — leak");
  } else {
    ok(`Client /api/clients → ${clientClients.status} (not a full list)`);
  }

  console.log("\nC6. Cloudinary upload (client on Starter):");
  const blob = new Blob([PNG_1X1], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, "e2e.png");
  form.append("title", "E2E ID proof");
  form.append("docType", "id_proof");
  form.append("caseUnitId", cse.unitId ?? "");
  form.append("clientUnitId", client.unitId ?? "");
  const upload = await fetch(`${PORTAL}/api/documents`, {
    method: "POST",
    headers: { Cookie: cookieHeader(clientJar) },
    body: form,
  });
  const uploadJson = (await upload.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { document?: { unitId?: string; fileKey?: string }; fileKey?: string };
    error?: { message?: string };
  };
  const doc = uploadJson.data?.document ?? uploadJson.data;
  const fileKey = (doc as { fileKey?: string } | undefined)?.fileKey;
  if (upload.ok && uploadJson.ok && fileKey?.startsWith("https://res.cloudinary.com/")) {
    ok(`Cloudinary URL stored ${fileKey.slice(0, 60)}…`);
  } else {
    fail(`Upload → ${upload.status} ${JSON.stringify(uploadJson).slice(0, 400)}`);
  }
  const docUnitId = (doc as { unitId?: string } | undefined)?.unitId;
  if (docUnitId) {
    const dl = await fetch(`${PORTAL}/api/documents/${docUnitId}/download`, {
      headers: { Cookie: cookieHeader(clientJar) },
    });
    if (dl.status === 200) ok("Document download 200");
    else fail(`Download → ${dl.status}`);
  }

  console.log("\nPlan gate (Starter staff must not use Pro documents vault):");
  const staffForm = new FormData();
  staffForm.append("file", new Blob([PNG_1X1], { type: "image/png" }), "staff.png");
  staffForm.append("title", "Staff vault");
  staffForm.append("docType", "other");
  staffForm.append("caseUnitId", cse.unitId ?? "");
  const staffUpload = await fetch(`${PORTAL}/api/documents`, {
    method: "POST",
    headers: { Cookie: cookieHeader(opJar) },
    body: staffForm,
  });
  const staffJson = (await staffUpload.json().catch(() => ({}))) as {
    error?: { code?: string };
  };
  if (staffUpload.status === 403 && staffJson.error?.code === "PLAN_REQUIRED") {
    ok("Starter staff documents API plan-gated");
  } else {
    fail(`Starter staff upload expected PLAN_REQUIRED, got ${staffUpload.status} ${JSON.stringify(staffJson)}`);
  }

  const csvGate = await jsonPost(
    `${PORTAL}/api/clients/import`,
    { dryRun: true, rows: [{ name: "X", mobile: "9876543210" }] },
    opJar
  );
  const csvErr = (csvGate.json.error as { code?: string } | undefined)?.code;
  if (csvGate.status === 403 && csvErr === "PLAN_REQUIRED") ok("Starter CSV import plan-gated");
  else fail(`CSV import expected PLAN_REQUIRED, got ${csvGate.status} ${JSON.stringify(csvGate.json)}`);

  console.log("\nC7. Razorpay test checkout:");
  const checkout = await jsonPost(
    `${PORTAL}/api/billing/checkout`,
    { planCode: "starter", billingCycle: "monthly", acceptTerms: true },
    opJar
  );
  const checkoutData = dataOf(checkout.json);
  if (checkout.json.ok && (checkoutData.orderId || checkoutData.id || checkoutData.keyId)) {
    ok(`Razorpay checkout started ${JSON.stringify(checkoutData).slice(0, 180)}`);
  } else {
    fail(`Checkout → ${checkout.status} ${JSON.stringify(checkout.json).slice(0, 400)}`);
  }

  console.log("\nB6. SA extend trial / suspend / reactivate:");
  const saJar: CookieJar = new Map();
  const saLogin = await jsonPost(
    `${ADMIN}/api/auth/login`,
    { mobile: ADMIN_MOBILE.length === 10 ? ADMIN_MOBILE : ADMIN_MOBILE.slice(-10), pin: ADMIN_PIN },
    saJar
  );
  if (!saLogin.json.ok) fail(`SA login → ${JSON.stringify(saLogin.json)}`);
  else ok("SA login for office ops");

  const sub = await prisma.subscription.findFirst({ where: { officeId: office.id } });
  if (!sub) fail("Subscription missing");
  else {
    const extend = await jsonPatch(
      `${ADMIN}/api/subscriptions/${sub.unitId}`,
      { extendTrialDays: 3 },
      saJar
    );
    if (extend.json.ok) ok("SA extend trial +3 days");
    else fail(`Extend trial → ${extend.status} ${JSON.stringify(extend.json)}`);
  }

  const suspend = await jsonPatch(
    `${ADMIN}/api/offices/${office.unitId}`,
    { status: "suspended" },
    saJar
  );
  if (suspend.json.ok) ok("SA suspend office");
  else fail(`Suspend → ${suspend.status} ${JSON.stringify(suspend.json)}`);

  const reactivate = await jsonPatch(
    `${ADMIN}/api/offices/${office.unitId}`,
    { status: "active" },
    saJar
  );
  if (reactivate.json.ok) ok("SA reactivate office");
  else fail(`Reactivate → ${reactivate.status} ${JSON.stringify(reactivate.json)}`);

  const leadsPage = await fetch(`${ADMIN}/meiyon/leads`, {
    headers: { Cookie: cookieHeader(saJar) },
    redirect: "manual",
  });
  if (leadsPage.status === 200) ok("SA /meiyon/leads → 200");
  else fail(`SA /meiyon/leads → ${leadsPage.status}`);

  console.log(failed ? `\nFollow-up done with ${failed} failure(s).` : "\nFollow-up: all extra steps passed.");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
