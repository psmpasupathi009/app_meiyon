# SAANRU Office Portal — Build Plan

**Website:** `app.saanru.com`  
**Audience:** Law office staff + invite-only client portal  
**Reference:** MLF codebase (full feature/flow parity)  
**Sibling docs:** [Super Admin](./01-website-super-admin.md) · [Marketing](./03-website-marketing.md)  
**Full product + DB:** [SAANRU product plan](../saanru_docs_split_336dbf47.plan.md)

---

## Purpose

Office Portal is the **full law-office product** — MLF feature parity with multi-tenant `officeId` isolation, subscription plan gates, and Razorpay billing. Staff run the office; clients get a limited invite-only portal on the **same domain**.

**MLF reference sources (prefer live code over stale guides):**

| Source | Use |
|--------|-----|
| [`config/company/nav.ts`](../../config/company/nav.ts) | Staff + client nav |
| [`config/company/modules.ts`](../../config/company/modules.ts) | Feature flags |
| [`config/company/permissions-defaults.ts`](../../config/company/permissions-defaults.ts) | Role matrix incl. `client` |
| [`lib/auth/client-portal.ts`](../../lib/auth/client-portal.ts) | Client path allowlist + upload types |
| [`prisma/schema.prisma`](../../prisma/schema.prisma) | Models |
| [`docs/website-guide.md`](../website-guide.md) | Flow pattern (**secondary** — misses court-roster, expenses, client `/documents`) |

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router · React |
| DB | Prisma 6 · MongoDB Atlas (shared; every row has `officeId`) |
| Auth | Mobile + PIN/OTP · JWT httpOnly cookie |
| RBAC | `RolePermission` per office · `module.action` keys |
| Files | Object storage keys `offices/{OFF}/…` · PDF/JPEG/PNG/WebP · 10 MB |
| SMS | 2Factor-like provider · hearing reminders |
| Payments | Razorpay checkout on `/billing` |
| Deploy | `apps/office-portal` · `app.saanru.com` |

**Cookie:** `meiyon_op_access`  
**JWT:** staff `sub`=EMP unitId, `oid`=OFF unitId; client also `cid`=CLI unitId

---

## Architecture

```text
app/(auth)/login/              → phone / PIN / OTP / office picker
app/(portal)/                  → session + AppShell + plan gates
app/(public)/legal/[slug]/     → terms, privacy (public allowlist)
app/api/**/                    → requireUser + officeId + requirePerm + Zod + audit
features/<domain>/             → UI + serialize
lib/auth/client-portal.ts      → client path allowlist
proxy.ts                       → page gate (skips /api)
```

**Gates on every request:**

```text
JWT → active User → Office active → Subscription allowed → plan∩modules → requirePerm
Cross-office access → 404 (never 403 leak)
```

```mermaid
flowchart TD
  req["Request"] --> jwt["JWT valid"]
  jwt --> user["User active"]
  user --> office["Office active"]
  office --> sub["Subscription trialing|active|past_due"]
  sub --> mod["Module in plan"]
  mod --> perm["Permission check"]
  perm --> handler["Handler"]
```

---

## Tenancy & IDs

Every domain row: **`officeId` + `officeUnitId` (`OFF-#####`)**.

| Rule | Detail |
|------|--------|
| UI/API/URLs | Public `unitId` only (`CLI`, `CSE`, `EMP`, …) |
| DB joins | Mongo ObjectId inside APIs only |
| Dual FK | Write/clear `xId` + `xUnitId` together |
| Uniqueness | `(officeId, mobile)` on User |
| Indexes | Always `(officeId, …)` on list queries |
| IdCounter | Unique `(officeId, entity)` per prefix |

**ID prefixes:** EMP · CLI · CSE · HRG · APT · PAY · EXP · DOC · LVE · ATT · HOL · AWH · ATB · DAK · TSK · NTF · CDU

**Office-scoped models:** User, OtpSession, RolePermission, AuditLog, Client, Case, Hearing, CashPayment, OfficeExpense, Document, Appointment, DakEntry, OfficeTask, Attendance, LeaveRequest, AdvocateWeeklyHours, AdvocateTimeBlock, OfficeHoliday, CourtDutyOverride, Notification

---

## Plan gates

| Plan | Code | Key unlocks |
|------|------|-------------|
| Starter | `starter` | Core + court roster + client portal + basic reports |
| Professional | `professional` | + accounts, expenses, dak, documents, CSV imports, full reports |
| Enterprise | `enterprise` | + HRMS, hearing SMS cron, full branding |

| Module | Starter | Professional | Enterprise |
|--------|---------|--------------|------------|
| dashboard, clients, cases, diary, appointments, availability, tasks, employees, permissions, activity, notifications | ✓ | ✓ | ✓ |
| court roster, client portal | ✓ | ✓ | ✓ |
| reports | basic | full | full |
| accounts, expenses, dak, documents, CSV imports | — | ✓ | ✓ |
| hrms, hearing SMS | — | — | ✓ |

**UI:** `ForbiddenState` when perm missing; `UpgradePrompt` when plan blocks module.  
**Seat limit:** block create/reactivate employee when active seats ≥ plan limit.

---

## Navigation

### Staff (`staffOnly` where noted)

| Group | Items | Gate |
|-------|-------|------|
| Workspace | Home | All |
| Matters | Clients*, Cases, Day board* | All |
| Schedule | Appointments, Availability*, Court roster* | All |
| Office | Accounts†, Expenses†, HRMS‡, Postal†, Work allotment, Reports, **Billing** | †‡ per plan |
| Admin | Employees*, Activity*, Permissions* | All |

\* staffOnly · † Professional+ · ‡ Enterprise

### Client

| Group | Items |
|-------|-------|
| Workspace | Home |
| Matters | Cases, Documents |
| Schedule | Appointments |

Source: [`config/company/nav.ts`](../../config/company/nav.ts) + Billing added under Office.

---

## Module inventory

Pattern per module: **purpose → IDs → path → steps → APIs → perms → plan gate**

---

### 1. Auth + office picker

**Purpose:** Staff/client login; multi-office picker; PIN setup.

**Path:** `/login`

**APIs:**
- `POST /api/auth/check-mobile`
- `POST /api/auth/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/setup-pin`
- `POST /api/auth/forgot-pin/reset`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/session-expired`
- `POST /api/auth/select-office` (SAANRU — when mobile in multiple offices)

**Flow:** check-mobile → (office list if multi) → PIN or OTP setup → cookie → `/`. Suspended/unpaid office → clear error.

**Models:** User, OtpSession, ConsumedOtpProof, OfficeMembership

**Plan gate:** All

---

### 2. RBAC / permissions

**Purpose:** Role matrix editor; effective permissions on session.

**Path:** `/permissions`

**APIs:** `GET/PUT /api/permissions/matrix`, `GET /api/permissions/preview`

**Roles:** `admin`, `sub_admin`, `staff`, `advocate`, `accountant`, **`client`** (portal only — not assignable via employees UI)

**Notes:** Matrix UI shows employee roles only; `client` matrix is seed-locked. Admin effectively unrestricted.

**Perms:** `permissions.view`, `permissions.edit`

**Plan gate:** All

---

### 3. Home / dashboard

**Purpose:** Office summary; client home shows own upcoming matters.

**Path:** `/`

**API:** `GET /api/dashboard/summary`

**Staff sees (MLF parity):**
- Counts (clients, open cases, today/tomorrow hearings)
- Attention cards (filing defects, overdue tasks, etc.)
- Upcoming hearings / appointments / tasks
- Office presence widget (HRMS — Enterprise)
- Personal attendance widget (HRMS own check-in)
- Fee / outstanding snippets for admin/sub_admin

**Client sees:** next hearings, upcoming appointments, quick book/upload — no office stats

**Perm:** `dashboard.view`

**Plan gate:** All

---

### 4. Clients + portal invite

**Purpose:** Client registry; invite/revoke client portal access.

**Paths:** `/clients`, `/clients/[unitId]`

**APIs:**
- `GET/POST /api/clients`
- `GET/PATCH /api/clients/[unitId]`
- `POST /api/clients/import`
- `POST|DELETE|GET /api/clients/[unitId]/portal-access`

**IDs:** `CLI-#####`

**Flow:** create (normalize mobile, **`smsConsent`**) → list/search → detail → link cases/payments → **Invite to portal** → OTP → client PIN.

**Client detail page (staff):** cases list, payments, **fee rollup**, documents panel, portal invite/revoke status card

**Collision:** invite fails if mobile already staff user.

**Compliance:** Aadhaar last-4 only when collected — never full Aadhaar ([`compliance.ts`](../../config/company/compliance.ts))

**Perms:** `clients.view|create|edit|upload`

**Plan gate:** All

---

### 5. Cases / hearings / checklist

**Purpose:** Matter pipeline, court data, hearings, filing checklist; fees via accounts; docs embedded.

**Paths:** `/cases`, `/cases/[unitId]`

**APIs:**
- `GET/POST /api/cases`
- `GET/PATCH /api/cases/[unitId]`
- `PATCH /api/cases/[unitId]/status`
- `GET/PATCH /api/cases/[unitId]/checklist`
- `GET/POST /api/cases/[unitId]/hearings`
- `POST /api/hearings/[unitId]/adjourn`
- `POST /api/cases/import`, `POST /api/hearings/import`

**IDs:** `CSE`, `HRG`; dual client FKs (`clientId` + `clientUnitId`)

**Flow:**
1. Create case with `clientUnitId`, court fields, advocates
2. Pipeline status via `canTransitionStatus`
3. Filing checklist / batta flags
4. Add hearing → updates `nextHearingAt` → may notify
5. Adjourn → new HRG + outcome
6. Documents panel + fee snippet from accounts

**UI:** DnD cases board on list page (MLF pattern); pipeline strip on detail; board columns from [`case-pipeline.ts`](../../config/company/case-pipeline.ts)

**Case pipeline statuses:** enquiry → engaged → pre_filing → under_filing → filing_defect → active → reserved → disposed → withdrawn → transferred → archived

**Transition rules:** `canTransitionStatus` (no arbitrary jumps)

**Case types:** [`case-types.ts`](../../config/company/case-types.ts) — Civil / Criminal / Family pickers

**Court stage (Layer B):** [`case-stages.ts`](../../config/company/case-stages.ts) — separate from pipeline status

**Checklist fields:** filing checklist JSON, `battaDue`, `awaitingService`

**Perms:** `cases.view|create|edit|upload`

**Plan gate:** All

---

### 6. Appointments / availability / convert-case

**Purpose:** Consultations; advocate hours/blocks; convert to enquiry case.

**Paths:** `/appointments`, `/availability`

**APIs:**
- `GET/POST /api/appointments`
- `GET/PATCH /api/appointments/[unitId]`
- `POST /api/appointments/[unitId]/convert-case`
- `POST /api/appointments/import`
- `GET /api/appointments/availability`
- `GET/PUT /api/advocates/availability/hours`
- `GET/POST /api/advocates/availability/blocks`
- `DELETE /api/advocates/availability/blocks/[unitId]`
- `GET /api/advocates`

**IDs:** `APT`, `AWH`, `ATB`

**Flow:** set weekly hours/blocks → book slot → complete/cancel → optional convert → enquiry `CSE`

**Modes:** `office` | `call` | `video` (staff); clients limited to **office | call** — `video` rejected by API

**Row scope:** non–office-bookers see own `advocateMobile` only

**Availability integration:**
- Default booking windows from [`booking.ts`](../../config/company/booking.ts) (IST, 15-min slots, Mon–Sat default)
- Advocate weekly hours (`AWH`) + time blocks (`ATB`)
- **Office holidays** (`OfficeHoliday`) block slots entirely for that date

**Perms:** `appointments.view|create|edit|cancel`

**Plan gate:** All

---

### 7. Court roster

**Purpose:** Permanent court assignments per advocate + duty overrides by date.

**Path:** `/court-roster`

**APIs:**
- `GET /api/court-roster`
- `GET/PUT /api/court-roster/permanent`
- `GET/POST /api/court-roster/overrides`
- `GET/PATCH/DELETE /api/court-roster/overrides/[unitId]`
- `GET /api/court-roster/available-advocates`

**Models:** `User.defaultCourts` (JSON), `CourtDutyOverride` (`CDU`)

**Perms:** `employees.view` (read), `employees.edit` (write)

**Plan gate:** All (Starter+)

---

### 8. Diary (day board)

**Purpose:** IST day aggregate: hearings + appointments + tasks.

**Path:** `/diary`

**APIs:**
- `GET /api/diary?date=&advocateMobile=`
- `POST /api/diary/send-hearing-sms`
- `POST /api/diary/tomorrow-notify`

**Access:** any of `cases.view` | `appointments.view` | `tasks.view`

**Enterprise:** SMS send respects monthly SMS quota

**Plan gate:** All

---

### 9. Accounts (cash ledger)

**Purpose:** Office cash book — not online client checkout.

**Path:** `/accounts`

**APIs:**
- `GET/POST /api/accounts`
- `GET/PATCH /api/accounts/[unitId]`
- `POST /api/accounts/[unitId]/void`
- `POST /api/accounts/import`

**IDs:** `PAY`; required dual Client; optional dual Case

**PaymentType enum:** advance, partial, full, consultation, court_fee, stamp, copying, travel, clerkage, other

**PaymentStatus:** pending, paid, void

**Flow:** payment on client (+ optional case) → list/filter/summary → void → case fee rollup on case detail

**Perms:** `accounts.view|create|edit|upload`

**Plan gate:** Professional+

---

### 10. Expenses

**Purpose:** Office expenses with optional bill document.

**Path:** `/expenses`

**APIs:**
- `GET/POST /api/expenses`
- `GET/PATCH /api/expenses/[unitId]`
- `POST /api/expenses/[unitId]/void`

**IDs:** `EXP`; optional bill `DOC` via `billDocumentId` + `billDocumentUnitId`

**OfficeExpenseCategory:** stationery, utilities, maintenance, travel, refreshments, equipment, professional_services, misc, others

**ExpensePaymentMode:** cash, upi, card, bank, other

**Perms:** `expenses.view|create|edit|upload`

**Plan gate:** Professional+

---

### 11. Documents (staff)

**Purpose:** File attachments on case/client/expense; static office PDFs.

**Paths:** Embedded on case/client/expense detail — **no standalone staff page**

**APIs:**
- `GET/POST /api/documents` (staff GET requires caseUnitId | clientUnitId | expenseUnitId)
- `DELETE /api/documents/[unitId]`
- `GET /api/documents/[unitId]/download`
- `GET /api/office-files/[slug]` (allowlisted private PDFs)

**IDs:** `DOC`; storage under `offices/{OFF}/…`; enforce plan storage quota

**DocumentType enum:** judgment, order, pleading, vakalatnama, petition, affidavit, evidence, id_proof, receipt, other

**Staff upload on:** case detail, **client detail**, expense bill — no standalone staff `/documents` page

**Perms:** by parent — cases/accounts/expenses upload rules

**Plan gate:** Professional+ (staff vault); client uploads Starter+ (count toward storage)

---

### 12. Tasks (work allotment)

**Purpose:** Assign and track office work; shows on diary.

**Path:** `/tasks`

**APIs:**
- `GET/POST /api/tasks`
- `GET/PATCH /api/tasks/[unitId]`
- `POST /api/tasks/import`

**IDs:** `TSK`; assignee dual FK (`EMP`); soft `caseUnitId`

**Row scope:** non-admin/sub_admin → own assignee only

**Perms:** `tasks.view|create|edit`

**Plan gate:** All

---

### 13. Dak (postal)

**Purpose:** In/out postal register.

**Path:** `/dak`

**APIs:**
- `GET/POST /api/dak`
- `GET/PATCH /api/dak/[unitId]`
- `POST /api/dak/import`

**IDs:** `DAK`; soft `caseUnitId` / `clientUnitId`

**Perms:** `dak.view|create|edit`

**Plan gate:** Professional+

---

### 14. HRMS

**Purpose:** Attendance, leave, holidays, team presence.

**Path:** `/hrms`

**APIs:**
- `GET/POST /api/hrms/attendance`
- `POST /api/hrms/attendance/check-in`
- `POST /api/hrms/attendance/check-out`
- `GET/POST /api/hrms/leave`
- `POST /api/hrms/leave/[unitId]/decide`
- `POST /api/hrms/leave/[unitId]/cancel`
- `GET/POST /api/hrms/holidays`
- `GET/PATCH/DELETE /api/hrms/holidays/[unitId]`
- `GET /api/hrms/presence`

**IDs:** `ATT`, `LVE`, `HOL`

**URL-driven tabs:** attendance history, leave, holidays, presence (`use-hrms-section-from-url`)

**Perms:** `hrms.view`, `own_attendance`, `own_leave`, `manage_attendance`, `approve_leave`

**Plan gate:** Enterprise

---

### 15. Employees

**Purpose:** Staff user CRUD; advocate list; photos.

**Path:** `/employees`

**APIs:**
- `GET/POST /api/employees`
- `GET/PATCH /api/employees/[unitId]`
- `POST /api/employees/[unitId]/deactivate`
- `POST /api/employees/[unitId]/reactivate`
- `POST /api/employees/[unitId]/force-reset-pin`
- `POST /api/employees/import`
- `POST /api/users/[unitId]/photo`

**IDs:** `EMP`

**Designations (MLF parity):** [`config/company/designations.ts`](../../config/company/designations.ts)
- Grouped job titles (Legal / Legal support / Office & accounts)
- `designationDefaultRoles` prefill on create/import (e.g. Managing Partner → admin+advocate)
- `LEGACY_DESIGNATION_ALIASES` for CSV import normalization
- Designation = display label only; roles are explicit and never derived at runtime

**Guards:** sub_admin cannot assign `admin` role (API enforced)

**Seat limit:** block create/reactivate when active seats ≥ plan → UpgradePrompt

**Perms:** `employees.view|create|edit|deactivate`

**Plan gate:** All

---

### 16. Notifications

**Purpose:** In-app inbox + optional SSE stream.

**Paths:** header bell + `/notifications`

**APIs:**
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/[unitId]/read`
- `POST /api/notifications/read-all`
- `GET /api/notifications/stream` (if SSE enabled)

**IDs:** `NTF`

**Plan gate:** All

---

### 17. Search / reports / activity / profile

| Flow | Path | API | Perm |
|------|------|-----|------|
| ⌘K search | header | `GET /api/search?q=` | auth |
| Reports | `/reports` | `GET /api/exports?type=` | `reports.view` (see exceptions) |
| Activity | `/activity` | `GET /api/activity` | `activity.view` |
| Profile | `/profile` | `GET/PATCH /api/profile`, `POST /api/profile/photo` | self |

**Export types (`GET /api/exports?type=`):**

| type | Requires | Notes |
|------|----------|-------|
| `cases` | `reports.view` | Excel |
| `clients` | `reports.view` | Excel |
| `employees` | `reports.view` | Excel |
| `tasks` | `reports.view` | Excel |
| `dak` | `reports.view` | Excel |
| `accounts` | `reports.view` | Excel |
| `expenses` | `reports.view` | Excel |
| `appointments` | `reports.view` | Excel |
| `fees-outstanding` | `reports.view` | Fee rollup Excel |
| `attendance` | `hrms.own_attendance` OR `hrms.manage_attendance` | **No** `reports.view`; export from HRMS tab |

Rate limit: 10 exports per 15 minutes per client.

**Reports:** basic on Starter; full exports on Professional+

**Plan gate:** All (reports tier varies)

---

### 18. CSV imports

**Pattern:** ImportDialog → dry-run → confirm → POST import

**Endpoints (Professional+):**
- `/api/clients/import`
- `/api/cases/import`
- `/api/hearings/import`
- `/api/appointments/import`
- `/api/employees/import`
- `/api/accounts/import`
- `/api/dak/import`
- `/api/tasks/import`

**No expenses CSV** in MLF.

Parent unitIds must resolve **inside same office**.

**Plan gate:** Professional+

---

### 19. Courts / locations pickers

**Purpose:** Seed config for case/client forms — not DB tables.

**APIs:**
- `GET /api/courts`
- `GET /api/courts/meta`
- `GET /api/locations/meta`

**Plan gate:** All

---

### 20. Legal pages

**Path:** `/legal/[slug]` — public allowlist

**Slugs:** `terms`, `privacy`, `consultation-policy`

**Source pattern:** [`config/company/legal.ts`](../../config/company/legal.ts) — per-office or platform copy for SAANRU

**Plan gate:** All (public)

---

### 21. Cron hearing SMS

**Path:** `GET /api/cron/hearing-sms` (Vercel cron + `CRON_SECRET`)

**Behavior:** Iterate offices with Enterprise SMS entitlement + active sub; skip if monthly SMS quota exhausted; update `UsageCounter`

**Also:** manual send from diary (`/api/diary/send-hearing-sms`)

**Plan gate:** Enterprise + SMS quota

---

### 22. Billing (Office Portal)

**Purpose:** Office admin self-serve upgrade/renew via Razorpay.

**Path:** `/billing` (admin / sub_admin)

**UI:** current plan, period end, usage meters (seats/SMS/storage), plan comparison, upgrade/renew, invoice list

#### Billing (Office Portal) {#billing-office-portal}

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/billing/subscription` | Current sub + plan + usage |
| GET | `/api/billing/plans` | Catalog for upgrade |
| POST | `/api/billing/checkout` | Razorpay order/subscription |
| POST | `/api/billing/change-plan` | Schedule upgrade/downgrade |
| POST | `/api/billing/cancel` | Cancel at period end |
| GET | `/api/billing/invoices` | Office invoices |
| POST | `/api/billing/webhooks/razorpay` | Signature-verified (no user JWT) |

**Past due banner** in AppShell when `past_due`; hard block when `suspended`/`expired`.

**Plan gate:** All offices (module always available to admins)

---

## Client portal (first-class)

Same app, same `/login`. Invite-only — not self-registration.

| Area | Behavior |
|------|----------|
| Identity | Staff **Invite to portal** → `User` `roles:[client]`, `clientUnitId=CLI-…`; OTP → PIN; revoke = `isActive=false` |
| Collision | Invite/update fails if mobile is already staff login |
| Nav | Home, Cases, Appointments, Documents (`clientOnly`); Profile via menu |
| Path allowlist | `/`, `/cases`, `/appointments`, `/documents`, `/profile`, `/notifications`, `/legal` |
| Perms (seed) | `dashboard.view`, `cases.view`, `cases.upload`, `appointments.view`, `appointments.create`, `appointments.cancel` |
| Cases | Own only, read-only; stripped fields: `agreedFee`, `notes`, `filingChecklist`, `battaDue`, `awaitingService` ([`client-scope.ts`](../../lib/auth/client-scope.ts)) |
| Appointments | Book **office \| call** only (no video); cancel scheduled only; no convert-case |
| Documents | `/documents` page; types `id_proof`, `evidence`, `affidavit`, `other`; no receipts/expense bills |
| Denied | Accounts, expenses, employees, HRMS, dak, tasks, availability, court roster, clients registry, CSV, fees |
| Plan | Starter+; uploads count toward office storage |

**API hard-scope:** all queries filter by `clientUnitId` from session (DB field is source of truth; JWT `cid` mirrors it)

**Page:** `app/(portal)/documents/page.tsx` — redirects staff away; clients only

Source: [`lib/auth/client-portal.ts`](../../lib/auth/client-portal.ts)

---

## Per-office config seeds (provision on create)

Copy MLF `config/company/*` into per-office records or tenant-scoped JSON at office wizard time:

| Seed | MLF source | Used by |
|------|------------|---------|
| Designations | `designations.ts` | Employees create/import |
| Case pipeline | `case-pipeline.ts` | Cases board + status |
| Case types | `case-types.ts` | Case forms |
| Case stages | `case-stages.ts` | Case detail court strip |
| Booking defaults | `booking.ts` | Availability slots |
| Courts | `courts-seed.ts` + `court-districts.json` | `/api/courts` |
| Locations | `locations-seed.json` | `/api/locations/meta` |
| Compliance | `compliance.ts` | Uploads, CSV limits, intake |
| SMS templates | `sms-templates.ts` | Hearing reminders |
| Permissions defaults | `permissions-defaults.ts` | RolePermission seed |
| Legal copy | `legal.ts` | `/legal/*` (office-branded) |

Platform-wide seeds can stay shared; office-specific branding/legal overrides stored on `Office`.

---

## Database access

All three SAANRU apps share **one MongoDB Atlas cluster** via Prisma.

```mermaid
flowchart LR
  sa["admin.saanru.com"] --> pkg["packages/db"]
  portal["app.saanru.com"] --> pkg
  marketing["saanru.com"] -->|"optional Lead model v1.1"| pkg
  pkg --> prisma["Prisma Client singleton"]
  prisma --> atlas[(MongoDB Atlas)]
```

### Connection

```text
# .env (all apps that touch DB — marketing v1 may omit)
DATABASE_URL=mongodb+srv://USER:PASS@CLUSTER/saanru
```

- **Provider:** MongoDB via Prisma 6 (`packages/db/prisma/schema.prisma`)
- **Client:** shared singleton in `packages/db/client.ts` (same pattern as MLF [`lib/db/prisma.ts`](../../lib/db/prisma.ts))
- **Verify:** `pnpm db:ping` from monorepo root
- **Generate:** `pnpm db:generate` after schema changes
- **Seed:** `pnpm db:seed` — platform owner, 3 plans, demo office + admin

### Tenancy in queries

Every portal API handler:

```text
1. Resolve officeId from JWT oid
2. Add where: { officeId } on all domain reads/writes
3. Resolve unitId → row scoped to same officeId
4. Wrong office → return 404
```

Super Admin reads platform models (`Office`, `Plan`, …) without domain case/client access.

### ID generation

`IdCounter` unique on `(officeId, entity)` — same prefixes as MLF [`ids.ts`](../../config/company/ids.ts) plus `OFF`, `PLN`, `SUB`, `INV`, `PADMIN`.

### File storage

MLF uses local `uploads/`; SAANRU production should use **S3-compatible object storage** with keys `offices/{OFF}/…` (Vercel ephemeral disk is not suitable for prod).

---

## Session & edge (MLF parity)

| Layer | Behavior |
|-------|----------|
| `proxy.ts` | Pages only; guests → `/login`; public: `/login`, `/legal/*` |
| Portal layout | No session → redirect `/api/auth/session-expired` |
| `apiFetch` | 401 → `/api/auth/session-expired` → clear cookie → `/login` |
| Client paths | `proxy.ts` + API enforce [`client-portal.ts`](../../lib/auth/client-portal.ts) allowlist |
| PIN lockout | `failedPinAttempts`, `pinLockedUntil` on User |
| OTP replay | `ConsumedOtpProof` jti one-time use |

---

## SMS & cron

- **Provider:** 2Factor-like SMS API (`TWO_FACTOR_*` env)
- **Template:** [`sms-templates.ts`](../../config/company/sms-templates.ts) — hearing reminder with client name, case label, date, court
- **Triggers:** cron `GET /api/cron/hearing-sms` + diary manual send + tomorrow-notify
- **Consent:** requires client `smsConsent` + mobile
- **Cron schedule:** Vercel `30 11 * * *` (IST morning); `CRON_SECRET` header required
- **Quota:** Enterprise plan + `UsageCounter.smsSent` per office per month

---

## UI patterns (from MLF)

AppShell, PageHeader, DataToolbar, FilterChipGroup, Table, PaginationBar, EmptyState, ForbiddenState, UpgradePrompt, dialogs, drawers, ImportDialog, UploadDocumentDialog, toasts, UnitIdBadge, theme toggle.

Office branding: display name + logo from `Office` record (Enterprise full color).

---

## Security

- Separate JWT secret from Super Admin
- All queries force `officeId`
- Plan + subscription checked in guard (modules + seats + SMS + storage)
- File keys under `offices/{OFF}/`
- Rate-limit auth; PIN lockout
- Client path enforced in layout + API

---

## Env (Office Portal deploy)

```text
DATABASE_URL=
JWT_SECRET_OP=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
TWO_FACTOR_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_ENABLE_SSE=0
```

---

## Implementation phases (this app)

| Phase | Deliverable |
|-------|-------------|
| 0 | Monorepo + schema with `officeId` on all domain models |
| 1 | Auth + office picker + employees + permissions |
| 2 | Clients (+ portal invite), cases/hearings, diary, home, notifications |
| 3 | Appointments, availability, court roster, client portal |
| 4 | Accounts, expenses, documents, dak, tasks, reports, imports |
| 5 | HRMS, cron SMS, billing `/billing`, branding |
| 6 | Isolation tests, subscription E2E, seed demo office |

---

## Test checklist

- Two offices; same mobile → picker; zero data leak (404 cross-office)
- Starter: no accounts/HRMS; Professional: accounts yes, HRMS no; Enterprise: all
- Seat limit blocks 6th user on Starter
- Invite client → OTP → PIN → client nav only
- Client sees own cases only; other CSE → 404
- Client books office + call; video rejected
- Client uploads doc; cannot access another client's file
- Staff mobile collision on invite → clear error
- Revoke portal → login blocked
- Court roster permanent + override CRUD
- Expenses void + bill DOC
- Trial → checkout → active; past_due → suspended → pay → active
- SA cookie rejected on portal APIs
- Full matter path: client → case → hearing → diary → payment → expense → dak → task → leave (Enterprise)

---

## Out of scope v1

- Custom domains per office
- Email login / OAuth
- Online fee collection from clients (cash ledger only)
- WhatsApp Business API (SMS only)
- In-app PDF viewer (download only, same as MLF)
- Knowledge base / wiki

**In scope:** Client portal on same domain (see above).
