# applications-db Phase 1 — Shared Contract + Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully working job-application tracker frontend (dashboard, applications search, detail with editable status timeline, statistics, reports with charts) running on an in-memory data layer that already implements the exact client interface the Phase 2 REST backend will serve, shipped as its own container.

**Architecture:** npm-workspaces monorepo. `packages/shared` holds Zod schemas, types, and every pure domain function (history editing, definitions, search, stats, Sankey) so the browser's memory client and the future API run identical logic. `apps/web` is a React SPA whose screens talk only to an `ApplicationsClient` interface; `MemoryClient` implements it now, `ApiClient` (built and unit-tested here against the Phase 2 routes) is selected by `VITE_DATA_SOURCE`.

**Tech Stack:** Node 22 LTS, TypeScript (strict), npm workspaces, Zod, Vitest, React + Vite, React Router, TanStack Query, Tailwind CSS, Apache ECharts (`echarts` + `echarts-for-react`), Testing Library, Playwright, nginx, Docker Compose. Use the latest stable version of each at install time.

**Spec:** `docs/superpowers/specs/2026-11-23-job-application-tracker-design.md`

**Out of this plan (Phase 2 plan):** `apps/api`, MongoDB, Mongo/memory backend drivers, fail-fast DB startup, nginx `/api` proxy, full-stack Compose default.

## Global Constraints

- TypeScript `strict: true` everywhere; no `any` in exported signatures.
- After `npm install`, nothing loads from the internet at runtime: no CDN links, no Google Fonts, no remote images. Use a system font stack; icons come from an npm package bundled at build time.
- Storage is selected by configuration only (`VITE_DATA_SOURCE=memory | api`); no UI control changes it.
- Statuses, exactly: `applied`, `screening`, `interview`, `offer`, `accepted`, `rejected`, `ghosted`, `withdrawn`.
- Sources, exactly: `linkedin`, `indeed`, `company_site`, `referral`, `recruiter`, `job_board`, `other`. Work modes: `onsite`, `hybrid`, `remote`.
- Stale threshold: no status change in **21 days**, active applications only.
- All domain dates (`dateApplied`, status-entry `date`, `followUpDate`) are **date-only strings `YYYY-MM-DD`** (plan decision: avoids timezone day-shifts). `createdAt`/`updatedAt` are ISO datetime strings.
- IDs are UUID v4 strings (`crypto.randomUUID()`).
- Domain functions never read the clock: they take `today: IsoDate` or `now: string` parameters.
- Web host port in Compose: `8080`.

## Review Focus

1. **Date-only values near midnight / non-UTC timezones** — "today" must be the user's local calendar date, and a stored `2026-11-23` must render as Nov 23 everywhere. Pinned by `todayIso` tests (Task 2) and `formatDate` test (Task 8).
2. **Status edits that break history order** — moving a later entry before `applied`, changing the first entry's status, or deleting the first entry must be rejected with a clear message, not silently reorder. Pinned in Task 3.
3. **Empty or tiny datasets** — zero applications, or a range with none, must show `—` / empty-state charts, never `NaN%` or a crashed chart. Pinned in Task 7 (`responseRate === null`) and Task 13 (empty report).
4. **Search text with special characters or accents** (`C++`, `Société`, `.NET`) — must match literally and case/accent-insensitively, never throw a regex error. Pinned in Task 5.
5. **Invalid form input** — salary min > max, missing company/role, malformed URL — must show a field error and not save. Pinned in Task 1 (schema) and Task 10 (form).

---

## File Structure

```
package.json                     workspaces root, scripts
tsconfig.base.json
CLAUDE.md
docker-compose.yml
packages/shared/
  package.json, tsconfig.json, vitest.config.ts
  src/index.ts                   re-exports
  src/enums.ts                   STATUSES, SOURCES, WORK_MODES, stage groups
  src/schemas.ts                 Zod schemas + inferred types
  src/dates.ts                   IsoDate helpers (todayIso, addDays, diffDays, weekStart)
  src/errors.ts                  DomainError
  src/history.ts                 create/update application, status-entry add/edit/remove
  src/definitions.ts             isActive, hasResponded, daysToFirstResponse, isStale, isFollowUpDue
  src/query.ts                   filterApplications (search/filter/sort/paginate)
  src/sankey.ts                  forwardPath, buildSankey
  src/stats.ts                   computeDashboard, computeReport
  test/*.test.ts                 one test file per src module
apps/web/
  package.json, tsconfig.json, vite.config.ts, index.html, tailwind setup
  Dockerfile, nginx.conf
  playwright.config.ts, e2e/smoke.spec.ts
  src/main.tsx, src/App.tsx      providers + router
  src/config.ts                  parseConfig / config
  src/lib/labels.ts              display labels for enums
  src/lib/format.ts              formatDate, formatPercent
  src/data/client.ts             ApplicationsClient interface, ClientError
  src/data/memoryClient.ts       MemoryClient
  src/data/apiClient.ts          ApiClient (fetch)
  src/data/seed.ts               generateSeed
  src/data/ClientProvider.tsx    context + useClient
  src/data/hooks.ts              TanStack Query hooks
  src/components/                Layout, QuickAddDialog, ApplicationForm, StatusTimeline,
                                 EChart, KpiTile, DateRangePicker, BackendGate, EmptyState
  src/pages/                     DashboardPage, ApplicationsPage, ApplicationDetailPage,
                                 StatisticsPage, ReportsPage, NotFoundPage
  src/**/*.test.tsx              colocated component tests
```

---

### Task 1: Monorepo scaffold, CLAUDE.md, shared enums and schemas

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `CLAUDE.md`
- Create: `packages/shared/package.json` (name `@applications-db/shared`, `"type": "module"`, `main`/`types` → `src/index.ts` so no build step is needed by consumers), `tsconfig.json`, `vitest.config.ts`
- Create: `packages/shared/src/enums.ts`, `src/schemas.ts`, `src/index.ts`
- Test: `packages/shared/test/schemas.test.ts`

**Interfaces:**
- Produces (`enums.ts`):
  - `STATUSES`, `type Status`; `PROGRESS_STAGES = ['applied','screening','interview','offer','accepted'] as const`; `ACTIVE_STATUSES = ['applied','screening','interview','offer'] as const`; `TERMINAL_EXIT_STATUSES = ['rejected','ghosted','withdrawn'] as const`; `NON_RESPONSE_STATUSES = ['applied','ghosted','withdrawn'] as const`
  - `SOURCES`, `type Source`; `WORK_MODES`, `type WorkMode`; `SALARY_PERIODS = ['year','month','hour']`
- Produces (`schemas.ts`, each with `z.infer` type of the same name minus `Schema`):
  - `IsoDateSchema` (regex `^\d{4}-\d{2}-\d{2}$` + real-calendar-date check), `type IsoDate = string`
  - `StatusEntrySchema { id: uuid, status: Status, date: IsoDate, note?: string }`
  - `ContactSchema { name: string min 1, role?, email?: email, phone?, notes? }`
  - `SalarySchema { min?: number ≥0, max?: number ≥0, currency: string length 3, period }` refined `min <= max` (error path `['max']`, message `"Max must be at least min"`)
  - `ApplicationSchema { id, company: min 1 trimmed, role: min 1 trimmed, postingUrl?: url, location?, workMode?, salary?, source, dateApplied: IsoDate, status: Status, statusHistory: StatusEntry[] min 1, followUpDate?: IsoDate, contacts: Contact[], notes?, createdAt: datetime, updatedAt: datetime }`
  - `CreateApplicationInputSchema` = Application editable fields: required `company, role, source, dateApplied`; optional the rest; `contacts` defaults `[]`. No `id/status/statusHistory/createdAt/updatedAt`.
  - `UpdateApplicationInputSchema` = `CreateApplicationInputSchema.partial()`
  - `StatusEntryInputSchema { status, date, note? }`; `StatusEntryPatchSchema` = its `.partial()`
  - `SortKey = 'dateApplied:desc' | 'dateApplied:asc' | 'company:asc' | 'updatedAt:desc'`
  - `ApplicationQuerySchema { q?: string, status?: Status[], source?: Source[], workMode?: WorkMode[], from?: IsoDate, to?: IsoDate, sort: SortKey default 'dateApplied:desc', page: int ≥1 default 1, pageSize: int 1..100 default 25 }`
  - `DateRangeSchema { from, to }` refined `from <= to` (message `"Start date must be on or before end date"`)
  - `type Page<T> = { items: T[]; total: number; page: number; pageSize: number }`

- [ ] **Step 1: Scaffold root.** Root `package.json`: `private: true`, `workspaces: ["packages/*", "apps/*"]`, scripts `test` (`npm run test --workspaces --if-present`), `typecheck` (`npm run typecheck --workspaces --if-present`), `dev` (`npm run dev -w apps/web`). `tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `noUncheckedIndexedAccess`, `skipLibCheck`. Shared package scripts: `test: vitest run`, `typecheck: tsc --noEmit`. Install `zod`, dev `vitest typescript`.

- [ ] **Step 2: Write the failing test** `packages/shared/test/schemas.test.ts`:

```ts
it('accepts a minimal create input and defaults contacts', () => {
  const r = CreateApplicationInputSchema.parse({ company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01' });
  expect(r.contacts).toEqual([]);
});
it('rejects blank company and role', () => {
  const r = CreateApplicationInputSchema.safeParse({ company: '  ', role: '', source: 'linkedin', dateApplied: '2026-11-01' });
  expect(r.success).toBe(false);
});
it('rejects impossible dates', () => {
  expect(IsoDateSchema.safeParse('2026-02-30').success).toBe(false);
  expect(IsoDateSchema.safeParse('2026-11-1').success).toBe(false);
});
it('rejects salary min > max on the max field', () => {
  const r = SalarySchema.safeParse({ min: 100, max: 50, currency: 'EUR', period: 'year' });
  expect(r.success).toBe(false);
  expect(r.error!.issues[0]!.path).toEqual(['max']);
});
it('rejects a non-URL postingUrl', () => {
  expect(CreateApplicationInputSchema.safeParse({ company: 'A', role: 'B', source: 'other', dateApplied: '2026-11-01', postingUrl: 'not a url' }).success).toBe(false);
});
it('applies query defaults', () => {
  expect(ApplicationQuerySchema.parse({})).toMatchObject({ sort: 'dateApplied:desc', page: 1, pageSize: 25 });
});
it('rejects an inverted date range', () => {
  expect(DateRangeSchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }).success).toBe(false);
});
```

- [ ] **Step 3: Run** `npm test -w packages/shared` — Expected: FAIL (modules not found).
- [ ] **Step 4: Implement** `enums.ts`, `schemas.ts`, `index.ts` (re-export everything) per Interfaces.
- [ ] **Step 5: Run** `npm test -w packages/shared && npm run typecheck -w packages/shared` — Expected: all PASS, no type errors.
- [ ] **Step 6: Write `CLAUDE.md`** (≤ 60 lines): project one-liner; pointers to the spec and the plans directory; workspace layout; commands (`npm install`, `npm test`, `npm run typecheck`, `npm run dev`, `docker compose up --build`); house rules — domain logic lives in `packages/shared` and is pure (clock passed in), dates are `YYYY-MM-DD` strings, storage chosen by config never UI, no runtime network assets, TDD, use superpowers workflow for new features.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(shared): scaffold monorepo, enums and schemas"`

---

### Task 2: Shared date helpers and DomainError

**Files:**
- Create: `packages/shared/src/dates.ts`, `src/errors.ts`
- Test: `packages/shared/test/dates.test.ts`

**Interfaces:**
- Produces:
  - `todayIso(now?: Date): IsoDate` — **local** calendar date of `now` (default `new Date()`)
  - `addDays(d: IsoDate, n: number): IsoDate`
  - `diffDays(later: IsoDate, earlier: IsoDate): number` — whole days, DST-safe (compute via UTC midnights)
  - `weekStart(d: IsoDate): IsoDate` — Monday of that ISO week
  - `class DomainError extends Error { code: DomainErrorCode }`, `type DomainErrorCode = 'ENTRY_NOT_FOUND' | 'FIRST_ENTRY_NOT_DELETABLE' | 'FIRST_ENTRY_MUST_BE_APPLIED' | 'ENTRY_BEFORE_APPLIED' | 'NOT_FOUND'`

- [ ] **Step 1: Write the failing test:**

```ts
it('todayIso uses the local date, not UTC', () => {
  const lateEvening = new Date(2026, 10, 23, 23, 30); // local 23:30
  expect(todayIso(lateEvening)).toBe('2026-11-23');
});
it('addDays crosses month and year', () => {
  expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
it('diffDays is DST-safe', () => {
  expect(diffDays('2026-03-30', '2026-03-28')).toBe(2);
  expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
});
it('weekStart returns Monday', () => {
  expect(weekStart('2026-11-23')).toBe('2026-11-23'); // Monday
  expect(weekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
});
```

- [ ] **Step 2: Run** `npm test -w packages/shared -- dates` — Expected: FAIL.
- [ ] **Step 3: Implement** `dates.ts` and `errors.ts`; export from `index.ts`.
- [ ] **Step 4: Run** same command — Expected: PASS. Also run once with `TZ=America/Los_Angeles npm test -w packages/shared -- dates` and `TZ=Asia/Singapore …` — Expected: PASS both.
- [ ] **Step 5: Commit** — `feat(shared): date helpers and DomainError`

---

### Task 3: Application and status-history operations

**Files:**
- Create: `packages/shared/src/history.ts`
- Test: `packages/shared/test/history.test.ts`

**Interfaces:**
- Consumes: schemas/types (Task 1), `DomainError` (Task 2)
- Produces (all pure; return a new object; `newId` injected for determinism):
  - `type IdGen = () => string`
  - `createApplication(input: CreateApplicationInput, newId: IdGen, now: string): Application` — history `[{ id, status: 'applied', date: input.dateApplied }]`, `status: 'applied'`, `createdAt = updatedAt = now`
  - `updateApplication(app: Application, patch: UpdateApplicationInput, now: string): Application` — if `patch.dateApplied` is given, sets the first entry's date too (same validation as below)
  - `addStatusEntry(app, input: StatusEntryInput, newId: IdGen, now: string): Application`
  - `updateStatusEntry(app, entryId: string, patch: StatusEntryPatch, now: string): Application`
  - `removeStatusEntry(app, entryId: string, now: string): Application`
- Rules (every op): history stable-sorted by `date` (ties keep insertion order); `status` = last entry's status; `dateApplied` = first entry's date; `updatedAt = now`.
  - First entry's status must stay `applied` → else `FIRST_ENTRY_MUST_BE_APPLIED`.
  - No other entry may be dated before the first entry; adding/editing such an entry, or moving the first entry after another → `ENTRY_BEFORE_APPLIED`.
  - Removing the first entry → `FIRST_ENTRY_NOT_DELETABLE`. Unknown `entryId` → `ENTRY_NOT_FOUND`.

- [ ] **Step 1: Write the failing tests** (use a counter `IdGen` and fixed `now`):

```ts
const base = createApplication({ company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01', contacts: [] }, ids(), NOW);

it('creates with a single applied entry', () => {
  expect(base.status).toBe('applied');
  expect(base.statusHistory).toEqual([{ id: 'id-1', status: 'applied', date: '2026-11-01' }]);
});
it('adding an entry dated earlier than a later one keeps date order and derives status', () => {
  let a = addStatusEntry(base, { status: 'interview', date: '2026-11-10' }, ids(10), NOW);
  a = addStatusEntry(a, { status: 'screening', date: '2026-11-05' }, ids(20), NOW);
  expect(a.statusHistory.map(e => e.status)).toEqual(['applied', 'screening', 'interview']);
  expect(a.status).toBe('interview');
});
it('editing dateApplied moves the first entry date', () => {
  expect(updateApplication(base, { dateApplied: '2026-10-30' }, NOW).statusHistory[0]!.date).toBe('2026-10-30');
});
it('editing the first entry date updates dateApplied', () => {
  expect(updateStatusEntry(base, 'id-1', { date: '2026-10-29' }, NOW).dateApplied).toBe('2026-10-29');
});
it('rejects an entry before applied', () => {
  expect(() => addStatusEntry(base, { status: 'screening', date: '2026-10-01' }, ids(), NOW)).toThrowError(expect.objectContaining({ code: 'ENTRY_BEFORE_APPLIED' }));
});
it('rejects moving dateApplied after a later entry', () => {
  const a = addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(10), NOW);
  expect(() => updateApplication(a, { dateApplied: '2026-11-06' }, NOW)).toThrowError(expect.objectContaining({ code: 'ENTRY_BEFORE_APPLIED' }));
});
it('rejects changing the first entry status', () => {
  expect(() => updateStatusEntry(base, 'id-1', { status: 'screening' }, NOW)).toThrowError(expect.objectContaining({ code: 'FIRST_ENTRY_MUST_BE_APPLIED' }));
});
it('rejects deleting the first entry; deleting the last re-derives status', () => {
  expect(() => removeStatusEntry(base, 'id-1', NOW)).toThrowError(expect.objectContaining({ code: 'FIRST_ENTRY_NOT_DELETABLE' }));
  const a = addStatusEntry(base, { status: 'rejected', date: '2026-11-05' }, ids(10), NOW);
  expect(removeStatusEntry(a, 'id-10', NOW).status).toBe('applied');
});
it('unknown entry id throws ENTRY_NOT_FOUND', () => {
  expect(() => removeStatusEntry(base, 'nope', NOW)).toThrowError(expect.objectContaining({ code: 'ENTRY_NOT_FOUND' }));
});
it('does not mutate its input', () => {
  const snapshot = structuredClone(base);
  addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(), NOW);
  expect(base).toEqual(snapshot);
});
```

- [ ] **Step 2: Run** `npm test -w packages/shared -- history` — Expected: FAIL.
- [ ] **Step 3: Implement** `history.ts`: each op builds the new history, then one private `finalize(app, history, now)` sorts, validates the rules, and derives `status`/`dateApplied`/`updatedAt`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(shared): application and status history operations`

---

### Task 4: Definitions (active, responded, stale, follow-up)

**Files:**
- Create: `packages/shared/src/definitions.ts`
- Test: `packages/shared/test/definitions.test.ts`

**Interfaces:**
- Produces:
  - `isActive(app: Application): boolean` — `status ∈ ACTIVE_STATUSES`
  - `hasResponded(app): boolean` — some history status ∉ `NON_RESPONSE_STATUSES`
  - `firstResponseEntry(app): StatusEntry | undefined`
  - `daysToFirstResponse(app): number | null`
  - `lastChangeDate(app): IsoDate` — last history entry date
  - `isStale(app, today: IsoDate, thresholdDays = 21): boolean` — active and `diffDays(today, lastChangeDate) >= thresholdDays`
  - `isFollowUpDue(app, today): boolean` — active, `followUpDate` set and `<= today`

- [ ] **Step 1: Write the failing tests** — build fixtures with Task 3 functions:
  - `hasResponded`: applied only → false; applied→ghosted → false; applied→screening→withdrawn → **true**.
  - `daysToFirstResponse`: applied 11-01 → screening 11-08 → `7`; applied only → `null`.
  - `isStale(app with last change 2026-11-01, '2026-11-22')` → true (21 days); `'2026-11-21'` → false; rejected app 60 days old → false.
  - `isFollowUpDue`: followUp `2026-11-23`, today `2026-11-23` → true; today `2026-11-22` → false; status `accepted` → false.
  - `isActive`: `offer` → true, `accepted` → false.
- [ ] **Step 2: Run** `npm test -w packages/shared -- definitions` — Expected: FAIL.
- [ ] **Step 3: Implement** `definitions.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(shared): domain definitions`

---

### Task 5: Search, filter, sort, paginate

**Files:**
- Create: `packages/shared/src/query.ts`
- Test: `packages/shared/test/query.test.ts`

**Interfaces:**
- Produces: `filterApplications(apps: Application[], query: ApplicationQuery): Page<Application>`
  - `q`: trimmed; empty → no text filter. Match is a plain substring (never a RegExp) after normalizing both sides with `toLocaleLowerCase()` + NFD diacritic stripping, against `company`, `role`, `notes`, `location`, each contact's `name` and `email`.
  - `status`/`source`/`workMode` arrays: OR within a field, AND across fields; empty array = no filter.
  - `from`/`to`: inclusive on `dateApplied`.
  - Sort per `SortKey`; ties broken by `id` for stable paging. `company:asc` uses `localeCompare` with `sensitivity: 'base'`.
  - Page beyond the end → `items: []` with correct `total`.

- [ ] **Step 1: Write the failing tests:**
  - `q: 'c++'` matches role `"Senior C++ Engineer"` and does not throw; `q: '.net'` doesn't match `"Ionet"`.
  - `q: 'societe'` matches company `"Société Générale"`; `q: 'ACME'` matches `"Acme"`.
  - `q` matches a contact email.
  - `status: ['interview','offer'], source: ['referral']` returns only referral apps in interview or offer.
  - `from: '2026-11-01', to: '2026-11-01'` includes an app applied that day.
  - `sort: 'company:asc'` orders `['acme','Beta','Zeta']`.
  - 30 apps, `page: 2, pageSize: 25` → 5 items, `total: 30`; `page: 3` → `[]`, `total: 30`.
- [ ] **Step 2: Run** `npm test -w packages/shared -- query` — Expected: FAIL.
- [ ] **Step 3: Implement** `query.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(shared): application search and filtering`

---

### Task 6: Forward-only Sankey

**Files:**
- Create: `packages/shared/src/sankey.ts`
- Test: `packages/shared/test/sankey.test.ts`

**Interfaces:**
- Produces:
  - `type SankeyNodeName = Status | 'no_response'`
  - `type SankeyData = { nodes: { name: SankeyNodeName }[]; links: { source: SankeyNodeName; target: SankeyNodeName; value: number }[] }`
  - `forwardPath(app: Application): SankeyNodeName[]`
  - `buildSankey(apps: Application[]): SankeyData` — counts each consecutive pair of every path; `nodes` = only names that appear in a link, ordered by `[...PROGRESS_STAGES, 'rejected','ghosted','withdrawn','no_response']`; links sorted the same way by source then target. No apps → `{ nodes: [], links: [] }`.

Algorithm for `forwardPath` (not determined by the signature):

```ts
const path: SankeyNodeName[] = [];
let maxIdx = -1;
for (const e of app.statusHistory) {
  const idx = PROGRESS_STAGES.indexOf(e.status as never);
  if (idx > maxIdx) { path.push(e.status); maxIdx = idx; }
}
if (TERMINAL_EXIT_STATUSES.includes(app.status as never)) path.push(app.status);
else if (path.length === 1 && app.status === 'applied') path.push('no_response');
return path;
```

- [ ] **Step 1: Write the failing tests** (history status sequences → expected path):
  - `[applied]` → `['applied','no_response']`
  - `[applied, interview]` (skips screening) → `['applied','interview']`
  - `[applied, screening, interview, screening, interview, offer]` → `['applied','screening','interview','offer']`
  - `[applied, screening, rejected]` → `['applied','screening','rejected']`
  - `[applied, ghosted]` → `['applied','ghosted']`
  - `[applied, interview, screening]` (current screening, went backwards) → `['applied','interview']`
  - `buildSankey` of the first and fourth fixtures → links `[{applied→screening:1},{applied→no_response:1},{screening→rejected:1}]` (in the ordering rule above), nodes `applied, screening, rejected, no_response`.
  - `buildSankey([])` → `{ nodes: [], links: [] }`.
- [ ] **Step 2: Run** `npm test -w packages/shared -- sankey` — Expected: FAIL.
- [ ] **Step 3: Implement** `sankey.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(shared): forward-only sankey builder`

---

### Task 7: Dashboard and report computations

**Files:**
- Create: `packages/shared/src/stats.ts`
- Test: `packages/shared/test/stats.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 6
- Produces:
  - `type ActivityItem = { applicationId: string; company: string; role: string; entry: StatusEntry }`
  - `type DashboardData = { activeCount: number; interviewCount: number; offerCount: number; responseRate: number | null; followUpsDue: Application[]; stale: Application[]; recentActivity: ActivityItem[] }`
  - `computeDashboard(apps: Application[], today: IsoDate): DashboardData` — `interviewCount`/`offerCount` = current status; `responseRate` all-time; `followUpsDue` sorted by `followUpDate` asc; `stale` sorted by `lastChangeDate` asc; `recentActivity` = 10 most recent history entries across all apps (date desc).
  - `DAYS_BUCKETS = ['0–3','4–7','8–14','15–30','31+'] as const`
  - `type ReportData = { range: DateRange | null; total: number; responded: number; responseRate: number | null; statusBreakdown: { status: Status; count: number }[]; bySource: { source: Source; count: number }[]; perWeek: { weekStart: IsoDate; count: number }[]; responseRateBySource: { source: Source; applications: number; responded: number; rate: number | null }[]; daysToFirstResponse: { bucket: typeof DAYS_BUCKETS[number]; count: number }[]; medianDaysToFirstResponse: number | null; sankey: SankeyData }`
  - `computeReport(apps: Application[], range?: DateRange): ReportData` — filter by `dateApplied` in range (inclusive) when given; `statusBreakdown`/`bySource` omit zero counts; `perWeek` contiguous and zero-filled from the range's (or data's) first week to last; `responseRateBySource` only sources with ≥1 application; histogram always has all 5 buckets; rates are fractions 0..1, `null` when denominator is 0.

- [ ] **Step 1: Write the failing tests:**
  - `computeReport([])` → `total 0`, `responseRate null`, `medianDaysToFirstResponse null`, `perWeek []`, all five buckets with `count 0`, `sankey` empty.
  - Fixture of 4 apps (2 linkedin: one screening, one ghosted; 1 referral interview; 1 indeed applied) → `responseRate 0.5`; linkedin `rate 0.5`, referral `rate 1`, indeed `rate 0`.
  - Range `2026-11-02..2026-11-15` with apps on 11-01, 11-03, 11-12 → `total 2`; `perWeek` = `[{weekStart:'2026-11-02',count:1},{weekStart:'2026-11-09',count:1}]`.
  - Days buckets: responses after 3, 4, 31 days → `0–3:1, 4–7:1, 31+:1` and `medianDaysToFirstResponse 4`.
  - `computeDashboard` with today `2026-11-23`: counts, `followUpsDue` excludes a rejected app with past follow-up, `stale` includes an applied app last changed 2026-11-01, `recentActivity.length <= 10` ordered newest first.
- [ ] **Step 2: Run** `npm test -w packages/shared -- stats` — Expected: FAIL.
- [ ] **Step 3: Implement** `stats.ts`; export everything from `index.ts`.
- [ ] **Step 4: Run** `npm test -w packages/shared && npm run typecheck -w packages/shared` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(shared): dashboard and report computations`

---

### Task 8: Web app scaffold, config, layout, formatting

**Files:**
- Create: `apps/web` via Vite React-TS template (package name `@applications-db/web`), Tailwind setup, `vitest` with `jsdom` + Testing Library setup file
- Create: `src/config.ts`, `src/lib/labels.ts`, `src/lib/format.ts`, `src/components/Layout.tsx`, `src/pages/NotFoundPage.tsx`, `src/App.tsx`, `src/main.tsx`
- Test: `src/config.test.ts`, `src/lib/format.test.ts`, `src/components/Layout.test.tsx`

**Interfaces:**
- Consumes: `@applications-db/shared` (workspace dependency `"*"`)
- Produces:
  - `type DataSource = 'memory' | 'api'`; `type AppConfig = { dataSource: DataSource; apiBaseUrl: string }`
  - `parseConfig(env: Record<string, unknown>): AppConfig` — reads `VITE_DATA_SOURCE` (unset → `'memory'`; any other value than the two → throws `Error('Invalid VITE_DATA_SOURCE "<value>": expected "memory" or "api"')`), `VITE_API_BASE_URL` (default `'/api'`)
  - `config: AppConfig = parseConfig(import.meta.env)`; `main.tsx` catches a throw and renders the message as plain text instead of the app
  - `STATUS_LABELS: Record<Status,string>`, `SOURCE_LABELS`, `WORK_MODE_LABELS` (e.g. `company_site` → `"Company site"`)
  - `formatDate(d: IsoDate): string` — e.g. `"Nov 23, 2026"`, built from the date parts (never `new Date('2026-11-23')`, which parses as UTC)
  - `formatPercent(rate: number | null): string` — `null` → `"—"`, `0.5` → `"50%"`
  - `Layout` — nav links Dashboard `/`, Applications `/applications`, Statistics `/statistics`, Reports `/reports`; header slot for the quick-add button (Task 10); footer text `Data source: In-memory (sample data, resets on reload)` or `Data source: API`
  - Routes in `App.tsx`: `/`, `/applications`, `/applications/:id`, `/statistics`, `/reports`, `*` → NotFound (pages are placeholders until their tasks)

- [ ] **Step 1: Scaffold** the Vite app, Tailwind, Vitest (`environment: 'jsdom'`), scripts `dev`, `build`, `preview`, `test: vitest run`, `typecheck: tsc --noEmit`. Install `react-router-dom`, `@tanstack/react-query`, an icon package (e.g. `lucide-react`). Remove template assets; use a system font stack.
- [ ] **Step 2: Write the failing tests:**

```ts
expect(parseConfig({})).toEqual({ dataSource: 'memory', apiBaseUrl: '/api' });
expect(parseConfig({ VITE_DATA_SOURCE: 'api' }).dataSource).toBe('api');
expect(() => parseConfig({ VITE_DATA_SOURCE: 'mongo' })).toThrow('Invalid VITE_DATA_SOURCE "mongo"');
expect(formatDate('2026-11-23')).toBe('Nov 23, 2026');
expect(formatPercent(null)).toBe('—');
expect(formatPercent(0.5)).toBe('50%');
```
  plus `Layout.test.tsx`: renders four nav links and the memory footer text.
- [ ] **Step 3: Run** `npm test -w apps/web` — Expected: FAIL.
- [ ] **Step 4: Implement** config, labels, format, Layout, routes.
- [ ] **Step 5: Run** `npm test -w apps/web && npm run typecheck -w apps/web && npm run build -w apps/web` — Expected: PASS, build succeeds.
- [ ] **Step 6: Run** `TZ=America/Los_Angeles npm test -w apps/web -- format` — Expected: PASS.
- [ ] **Step 7: Commit** — `feat(web): scaffold app, config, layout`

---

### Task 9: Data layer — client interface, MemoryClient, ApiClient, seed, hooks

**Files:**
- Create: `src/data/client.ts`, `memoryClient.ts`, `apiClient.ts`, `seed.ts`, `ClientProvider.tsx`, `hooks.ts`
- Modify: `src/App.tsx` (wrap in `QueryClientProvider` + `ClientProvider`)
- Test: `src/data/memoryClient.test.ts`, `src/data/apiClient.test.ts`, `src/data/seed.test.ts`

**Interfaces:**
- Consumes: all shared exports
- Produces:
  - `interface ApplicationsClient { list(q: ApplicationQuery): Promise<Page<Application>>; get(id: string): Promise<Application>; create(i: CreateApplicationInput): Promise<Application>; update(id: string, p: UpdateApplicationInput): Promise<Application>; remove(id: string): Promise<void>; addStatus(id: string, i: StatusEntryInput): Promise<Application>; updateStatus(id: string, entryId: string, p: StatusEntryPatch): Promise<Application>; removeStatus(id: string, entryId: string): Promise<Application>; dashboard(today: IsoDate): Promise<DashboardData>; statistics(): Promise<ReportData>; report(range: DateRange): Promise<ReportData>; health(): Promise<{ ok: boolean; storage: string }> }`
  - `class ClientError extends Error { status: number; code: string }` — `404 'NOT_FOUND'`, `400 'VALIDATION'` (with `issues`), `409 <DomainErrorCode>`, `503 'UNAVAILABLE'`, `0 'NETWORK'`
  - `class MemoryClient implements ApplicationsClient` — constructor `(initial: Application[] = [], clock = { now: () => new Date() })`; validates inputs with the shared schemas (→ `ClientError 400`), maps `DomainError` → `ClientError 409` with the same code, missing id → `404`; returns `structuredClone`s; `health()` → `{ ok: true, storage: 'memory' }`
  - `class ApiClient implements ApplicationsClient` — constructor `(baseUrl: string, fetchFn = fetch)`. Routes (the Phase 2 contract): `GET /applications?…` (arrays as repeated params), `GET/PATCH/DELETE /applications/:id`, `POST /applications`, `POST /applications/:id/status`, `PATCH/DELETE /applications/:id/status/:entryId`, `GET /dashboard?today=`, `GET /stats`, `GET /reports?from=&to=`, `GET /health`. Error body `{ code, message, issues? }` → `ClientError(status, code)`; fetch rejection → `ClientError(0,'NETWORK')`.
  - `generateSeed(today: IsoDate, count = 45): Application[]` — deterministic (seeded PRNG, fixed seed), dates spread over the 120 days before `today`, covers every status and source, realistic company/role names, some contacts/notes/salaries, ~5 follow-ups due and ~3 stale.
  - `ClientProvider({ client, children })`, `useClient(): ApplicationsClient`; `createClient(config: AppConfig): ApplicationsClient` — memory → `new MemoryClient(generateSeed(todayIso()))`, api → `new ApiClient(config.apiBaseUrl)`
  - Hooks (query keys in brackets): `useApplications(q)` `['applications', q]`, `useApplication(id)` `['application', id]`, `useDashboard()` `['dashboard']`, `useStatistics()` `['statistics']`, `useReport(range)` `['report', range]`; mutations `useCreateApplication`, `useUpdateApplication`, `useDeleteApplication`, `useAddStatus`, `useUpdateStatus`, `useRemoveStatus` — each invalidates `applications`, `application`, `dashboard`, `statistics`, `report` on success.

- [ ] **Step 1: Write the failing tests:**
  - MemoryClient: `create` then `get` returns it; `list({ q: 'acme' })` finds it; `update` with `{ company: '' }` rejects `ClientError` status 400; `addStatus` dated before applied rejects status 409 code `ENTRY_BEFORE_APPLIED`; `get('missing')` rejects 404; mutating a returned object does not change the next `get`.
  - ApiClient with a fake `fetchFn`: `list({ status: ['applied','offer'], page: 2 })` requests `/api/applications?status=applied&status=offer&page=2&…`; a `409 {code:'ENTRY_BEFORE_APPLIED'}` response rejects with that code; a rejected fetch rejects with status 0 code `NETWORK`; `report({from,to})` requests `/api/reports?from=…&to=…`.
  - Seed: `generateSeed('2026-11-23')` is deep-equal across two calls; every item passes `ApplicationSchema`; all 8 statuses and 7 sources appear; no date is after today.
- [ ] **Step 2: Run** `npm test -w apps/web -- data` — Expected: FAIL.
- [ ] **Step 3: Implement** the data layer files and wire providers in `App.tsx` using `createClient(config)`.
- [ ] **Step 4: Run** `npm test -w apps/web && npm run typecheck -w apps/web` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): data layer with memory and API clients`

---

### Task 10: Quick-add dialog and full application form

**Files:**
- Create: `src/components/QuickAddDialog.tsx`, `src/components/ApplicationForm.tsx`
- Modify: `src/components/Layout.tsx` (header "Add application" button opens the dialog)
- Test: `src/components/QuickAddDialog.test.tsx`, `src/components/ApplicationForm.test.tsx`

**Interfaces:**
- Consumes: `useCreateApplication`, `useUpdateApplication`, schemas, labels
- Produces:
  - `QuickAddDialog({ open, onClose })` — fields company, role, source (select), date applied (defaults to `todayIso()`); on success closes and navigates to `/applications/:id`; Esc closes.
  - `ApplicationForm({ initial: Application, onSaved })` — every editable field incl. salary, contacts list (add/remove rows), follow-up date, notes; validates with `UpdateApplicationInputSchema` client-side and shows each Zod issue next to its field; server `ClientError` 400/409 messages shown at the top.

- [ ] **Step 1: Write the failing tests** (render inside providers with a `MemoryClient([])`):
  - Quick-add: date field defaults to today; submitting with empty company shows "Company is required" and creates nothing; valid submit creates one application (assert via `client.list({})` total 1).
  - Form: salary min 100 / max 50 shows "Max must be at least min" and does not call update; invalid URL shows an error on the URL field; adding a contact and saving persists it.
- [ ] **Step 2: Run** `npm test -w apps/web -- QuickAdd ApplicationForm` — Expected: FAIL.
- [ ] **Step 3: Implement** both components (plain controlled inputs + Zod; no form library needed).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): quick-add and application form`

---

### Task 11: Applications search page and detail page with editable timeline

**Files:**
- Create: `src/pages/ApplicationsPage.tsx`, `src/pages/ApplicationDetailPage.tsx`, `src/components/StatusTimeline.tsx`, `src/components/EmptyState.tsx`
- Test: `src/pages/ApplicationsPage.test.tsx`, `src/components/StatusTimeline.test.tsx`

**Interfaces:**
- Consumes: `useApplications`, `useApplication`, status/delete mutations, `ApplicationForm`
- Produces:
  - `ApplicationsPage` — search box (debounced 250 ms), multi-select filters status/source/work mode, date-from/to, sort select, paginated table (company, role, status, source, date applied, last change); row click → detail. **Query state lives in the URL search params** so back/refresh keep filters. Empty result → `EmptyState` "No applications match these filters" with a "Clear filters" button.
  - `ApplicationDetailPage` — header (company, role, status badge), `ApplicationForm` in edit mode, `StatusTimeline`, delete button with confirm dialog → navigates to `/applications`. Unknown id → "Application not found" with link back.
  - `StatusTimeline({ application })` — entries oldest→newest with date, status, note; "Add status" inline form (status select defaulting to the next progress stage, date defaulting to today, note); edit/delete per entry; delete hidden on the first entry; 409 errors shown inline using `DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode,string>` (e.g. `ENTRY_BEFORE_APPLIED` → "A status can't be dated before the application date.").

- [ ] **Step 1: Write the failing tests:**
  - ApplicationsPage with 3 seeded apps: typing "acme" (fake timers, advance 250 ms) leaves only Acme rows; selecting status `interview` filters; the URL contains `q=acme`; a no-match search shows the empty state and "Clear filters" restores all rows.
  - StatusTimeline: first entry has no delete button; adding `screening` dated before applied shows "A status can't be dated before the application date."; adding a valid `interview` entry shows it and the badge updates to Interview.
- [ ] **Step 2: Run** `npm test -w apps/web -- ApplicationsPage StatusTimeline` — Expected: FAIL.
- [ ] **Step 3: Implement** the pages and components.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): applications search and detail pages`

---

### Task 12: Dashboard and Statistics pages

**Files:**
- Create: `src/pages/DashboardPage.tsx`, `src/pages/StatisticsPage.tsx`, `src/components/KpiTile.tsx`, `src/components/EChart.tsx`, `src/components/charts.ts`
- Test: `src/pages/DashboardPage.test.tsx`, `src/components/charts.test.ts`

**Interfaces:**
- Consumes: `useDashboard`, `useStatistics`, `ReportData`, `DashboardData`
- Produces:
  - `EChart({ option, ariaLabel, onReady? })` — thin wrapper over `echarts-for-react`, SVG renderer, `onReady(instance)` for export; respects light/dark via CSS variables. In tests this module is mocked.
  - `charts.ts` (pure, testable): `sankeyOption(d: SankeyData)`, `statusDonutOption(d)`, `sourceDonutOption(d)`, `perWeekOption(d)`, `responseRateBySourceOption(d)`, `daysHistogramOption(d)` — each returns an ECharts option using `STATUS_LABELS`/`SOURCE_LABELS` (`no_response` label "No response yet").
  - `DashboardPage` — KPI tiles Active / In interview / Offers / Response rate; lists Follow-ups due, Stale (21+ days without change) with a one-click "Mark ghosted" action, Recent activity; each item links to its detail page; empty lists show short empty text.
  - `StatisticsPage` — all-time `ReportData`: totals, response rate, median days to first response, and the same six charts as Reports (no range).

- [ ] **Step 1: Write the failing tests:**
  - `charts.test.ts`: `sankeyOption` maps node `no_response` to label "No response yet" and preserves link values; `statusDonutOption` with empty `statusBreakdown` returns an option whose series data is `[]` (no NaN anywhere — assert `JSON.stringify(option)` does not contain `NaN`).
  - DashboardPage with a `MemoryClient` holding a known fixture and fixed today: tiles show the right counts; response-rate tile shows "—" when there are no applications; "Mark ghosted" on a stale item moves it out of the Stale list.
- [ ] **Step 2: Run** `npm test -w apps/web -- Dashboard charts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `DashboardPage` passes `todayIso()` through `useDashboard`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): dashboard and statistics`

---

### Task 13: Reports page with date range and export

**Files:**
- Create: `src/pages/ReportsPage.tsx`, `src/components/DateRangePicker.tsx`, `src/print.css`
- Test: `src/pages/ReportsPage.test.tsx`, `src/components/DateRangePicker.test.tsx`

**Interfaces:**
- Consumes: `useReport`, `charts.ts`, `EChart`
- Produces:
  - `DateRangePicker({ value: DateRange, onChange })` — presets "Last 30 days", "Last 90 days", "This year", "Custom" (two date inputs; shows "Start date must be on or before end date" and doesn't call `onChange` when inverted). Preset ranges computed from `todayIso()` with `addDays` (last 30 days = `addDays(today,-29)..today`).
  - `ReportsPage` — range in URL params (`from`, `to`; default last 90 days); summary line (applications, response rate); six charts each with a "Download PNG" button (`instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor })` → anchor download named `applications-<chart>-<from>_<to>.png`); "Print / Save as PDF" button calls `window.print()`; `print.css` hides nav/buttons and gives each chart its own block. Range with no applications → one `EmptyState` "No applications in this date range" instead of six empty charts.

- [ ] **Step 1: Write the failing tests:**
  - DateRangePicker: "Last 30 days" with today `2026-11-23` emits `{from:'2026-10-25', to:'2026-11-23'}`; inverted custom range shows the error and emits nothing.
  - ReportsPage (EChart mocked): default URL produces a last-90-days request; a range with no data shows "No applications in this date range"; the print button calls `window.print`.
- [ ] **Step 2: Run** `npm test -w apps/web -- Reports DateRangePicker` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): reports with date range and export`

---

### Task 14: Backend gate (API-mode health check)

**Files:**
- Create: `src/components/BackendGate.tsx`
- Modify: `src/App.tsx` (wrap routes in `BackendGate`)
- Test: `src/components/BackendGate.test.tsx`

**Interfaces:**
- Consumes: `useClient`, `AppConfig`
- Produces: `BackendGate({ dataSource, children })` — `memory`: renders children immediately. `api`: calls `client.health()`; while pending shows "Connecting…"; on `ok: false` or any rejection shows a full-screen panel "Can't reach the backend" with the error message and a "Retry" button; children render only after `ok: true`. Additionally, any query error with `ClientError` status `0` or `503` anywhere in the app re-shows this panel (via the `QueryClient`'s `queryCache.onError`).

- [ ] **Step 1: Write the failing tests** with fake clients: memory mode never calls `health`; api mode with rejecting `health` shows "Can't reach the backend" and not the children; clicking Retry after the fake starts succeeding renders the children.
- [ ] **Step 2: Run** `npm test -w apps/web -- BackendGate` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w apps/web` — Expected: all PASS.
- [ ] **Step 5: Commit** — `feat(web): backend availability gate`

---

### Task 15: Restyle with shadcn/ui (maroon theme)

**Spec:** `docs/superpowers/specs/2026-11-24-restyle-design.md` (approved 2026-11-24). Purely visual, plus dialog accessibility; no behaviour changes.

**Files:**
- Create: `apps/web/components.json` (shadcn config), `apps/web/src/lib/utils.ts` (`cn`), `apps/web/src/components/ui/{button,card,input,label,textarea,badge,table,dialog,alert-dialog}.tsx` (+ native-select styling: shadcn `native-select` if the registry has it, else a `selectClassName` export in `ui/input.tsx`)
- Create: `apps/web/src/lib/statusColors.ts`, `apps/web/src/lib/statusColors.test.ts`
- Modify: `apps/web/src/index.css` (theme tokens), `apps/web/tsconfig.json` + `apps/web/vite.config.ts` (`@/*` → `src/*` alias), `apps/web/package.json`
- Modify (restyle only): `Layout`, `QuickAddDialog`, `ApplicationForm`, `Field`, `StatusBadge`, `StatusTimeline`, `EmptyState`, `KpiTile`, `DateRangePicker`, `ReportCharts`, `charts.ts`, and every page in `src/pages/`
- Test: `statusColors.test.ts`, `charts.test.ts`, `QuickAddDialog.test.tsx`, `StatusTimeline.test.tsx`, `ApplicationDetailPage.test.tsx`; other tests change only where markup changed

**Interfaces:**
- Consumes: everything from Tasks 8–14 unchanged (props, hooks, routes, accessible names/labels).
- Produces:
  - Theme tokens in `index.css` (shadcn variable names): `--primary` maroon `#7B1E2E`, `--primary-foreground` white, primary hover `#5E1622`, `--foreground` `#111111`, `--background` white, borders/muted greys, `--radius` `0.375rem`. No shadows (`shadow-none`), no gradients. Font stays the existing system stack.
  - `lib/statusColors.ts`: `STATUS_COLORS: Record<Status, { hex: string; badgeClass: string }>`, muted, per spec: applied slate, screening sky, interview amber, offer emerald, accepted green, rejected rose, ghosted stone, withdrawn zinc. `SOURCE_COLORS: Record<Source, string>` (hex, muted categorical, none maroon).
  - `StatusBadge` uses `STATUS_COLORS[s].badgeClass` (via `ui/badge`); `charts.ts` uses `STATUS_COLORS[s].hex` for status donut items and status Sankey nodes, `SOURCE_COLORS` for source donut and response-rate-by-source bars; the `no_response` Sankey node is neutral grey. Sankey link `color: 'gradient'` stays (link colours come from node colours).
  - Layout: maroon header bar (`bg-primary`), white app name and nav links, active link underlined; "Add application" is a white button with maroon text. Content on white cards with 1px border.
  - Quick-add uses `ui/dialog`; every delete/remove confirmation uses `ui/alert-dialog`.
- Setup: `npx shadcn@latest init` / `add` run from `apps/web` (setup-time download into the npm cache only; nothing global), or copy component source by hand. Commit generated files and `package-lock.json`.

- [ ] **Step 1: Write the failing tests**
  - `statusColors.test.ts`: every status in `STATUSES` has an entry; the 8 `hex` values are distinct; none equals `#7B1E2E`; every source in `SOURCES` has a `SOURCE_COLORS` entry.
  - `charts.test.ts`: `statusDonutOption([{status:'interview',count:2}])` → that datum's `itemStyle.color === STATUS_COLORS.interview.hex`; `sankeyOption` gives node `offer` `itemStyle.color === STATUS_COLORS.offer.hex`.
  - `QuickAddDialog.test.tsx`: open via "Add application", press Escape → dialog gone and focus is on the "Add application" button.
  - `StatusTimeline.test.tsx` / `ApplicationDetailPage.test.tsx`: the remove/delete confirmation has role `alertdialog`; Escape cancels it and nothing is removed.
- [ ] **Step 2: Run** `npm test -w apps/web -- statusColors charts QuickAdd StatusTimeline ApplicationDetail`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add shadcn setup and components, tokens, `statusColors.ts`; swap dialogs; restyle each component and page with the `ui/*` primitives. Keep every existing label, button name and role so behaviour tests still find them. Selects stay native `<select>`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS, output free of warnings (Radix `DialogContent` requires a `DialogTitle`/`Description`; provide them).
- [ ] **Step 5: Verify offline:** `npm run build -w apps/web`, then search `apps/web/dist` for `http://` / `https://` outside license comments. Expected: no external asset URLs.
- [ ] **Step 6: Visual check:** `npm run dev`; the controller opens it in the browser pane and checks each route (Dashboard, Applications, Detail, Statistics, Reports, quick-add) at desktop and 375px widths.
- [ ] **Step 7: Commit:** `feat(web): restyle with shadcn/ui maroon theme`

---

### Task 16: Container, Compose, and end-to-end smoke test

**Files:**
- Create: `apps/web/Dockerfile`, `apps/web/nginx.conf`, `.dockerignore`, `docker-compose.yml`
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`
- Modify: `CLAUDE.md` (Docker + e2e commands), root `package.json` (`e2e` script)

**Interfaces:**
- Produces:
  - Dockerfile: multi-stage; build stage `node:22-alpine`, build context = repo root, copies root manifests + `packages/shared` + `apps/web`, `npm ci`, `ARG VITE_DATA_SOURCE=memory`, `npm run build -w apps/web`; runtime stage `nginx:alpine` serving `apps/web/dist`.
  - `nginx.conf`: SPA fallback (`try_files $uri /index.html`), long cache for hashed `/assets/`, no cache for `index.html`. (The `/api` proxy is added in Phase 2.)
  - `docker-compose.yml`: service `web` building `apps/web/Dockerfile` with context `.`, build arg `VITE_DATA_SOURCE: memory`, ports `8080:80`.
  - Playwright: runs against `vite preview` (webServer, memory mode), Chromium only.

- [ ] **Step 1: Write the failing e2e test** `e2e/smoke.spec.ts`: open `/` → dashboard tiles visible; quick-add "Smoke Test Co" / "QA Engineer" → lands on detail; add status "Interview" → badge shows Interview; go to Applications, search "smoke" → exactly one row; open Reports → the Sankey chart container is visible; footer shows "In-memory".
- [ ] **Step 2: Run** `npx playwright install chromium` (setup, needs internet) then `npm run e2e -w apps/web` — Expected: PASS (all features exist by now; if it fails, fix the app, not the test).
- [ ] **Step 3: Verify no runtime network assets:** `npm run build -w apps/web` then search `apps/web/dist` for `http://` / `https://` outside source-map comments and license headers — Expected: no external asset URLs.
- [ ] **Step 4: Add** Dockerfile, nginx.conf, `.dockerignore` (node_modules, dist, test results), compose file.
- [ ] **Step 5: Run** `docker compose up --build -d` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/applications` — Expected: `200` (SPA fallback). Then `docker compose down`.
- [ ] **Step 6: Run full suite** `npm test && npm run typecheck` — Expected: all PASS.
- [ ] **Step 7: Commit** — `feat(web): container, compose and e2e smoke test`

---

## Phase 2 contract notes (for the backend plan)

The API must serve exactly the routes listed in Task 9's `ApiClient`, use `{ code, message, issues? }` error bodies with the status codes listed under `ClientError`, and compute everything with the shared functions (`filterApplications`, history ops, `computeDashboard`, `computeReport`). `GET /dashboard?today=` is an addition to the spec's route list: the dashboard needs follow-ups/stale/recent activity, which `/stats` doesn't carry, and "today" must be the user's local date, so the client sends it.

Response and error details to fix at the start of Phase 2:
- `DELETE /applications/:id` -> 204 with no body.
- `DELETE /applications/:id/status/:entryId` -> 200 with the updated Application JSON.
- An unknown application id or unknown status-entry id -> 404. MemoryClient currently maps `ENTRY_NOT_FOUND` to 409; align the two (change MemoryClient to 404 or document otherwise) before the API lands.
- The API must parse query strings with coercion (`page`/`pageSize` as numbers via `z.coerce`, a single `status=x` value accepted as an array) rather than reusing the browser-side schema as-is.
- `ApiClient` should wrap a 2xx non-JSON body as `ClientError(status, 'BAD_RESPONSE')` instead of letting a raw `SyntaxError` escape; a misconfigured proxy returning `index.html` is the likely first failure.

---

## Execution status (resumed 2026-11-24)

Executed with superpowers:subagent-driven-development on branch `phase1-frontend` (local; not pushed, not merged). Each task: fresh implementer → task review (spec + quality) → fix rounds until clean.

| Task | Status | Commits |
|---|---|---|
| 1 Scaffold, enums, schemas | ✅ done | 55a8ff0, 847ac7d |
| 2 Dates, DomainError | ✅ done | a85c6b7 |
| 3 History operations | ✅ done | 81f0133 |
| 4 Definitions | ✅ done | 65bfa6a |
| 5 Search/filter | ✅ done | b7186fd |
| 6 Sankey | ✅ done | 4a07242, ac92dae |
| 7 Dashboard/report stats | ✅ done | fc362b1 |
| 8 Web scaffold | ✅ done | 1358eb0 |
| 9 Data layer | ✅ done | 1e744fc |
| 10 Quick-add + form | ✅ done | 83126c3, 997a32a |
| 11 Search + detail pages | ✅ done | c0bf2dc, a92d131 |
| 12 Dashboard + Statistics | ✅ done | 68e15fb |
| 13 Reports | ✅ done (review pending at time of writing) | 1b615a6 |
| 14 Backend gate | ⏳ next | |
| 15 Restyle with shadcn/ui (added 2026-11-24) | pending | |
| 16 Container, Compose, e2e | pending — **needs owner approval first** for host changes: Playwright Chromium download (`%LOCALAPPDATA%\ms-playwright`), Docker image pulls (`node:22-alpine`, `nginx:alpine`), image/container/network creation | |
| Final whole-branch review | pending (most capable model; triage the deferred minors below) | |

**To resume:** check out `phase1-frontend`, run `npm install`, `npm test`, `npm run typecheck` (expect all green), then continue subagent-driven development at Task 12. Owner rules in `CLAUDE.md` apply (no push / no host changes without approval).

### Rulings made during execution (binding for remaining tasks and Phase 2)

- `useDashboard()` takes no args; it calls `client.dashboard(todayIso())` internally.
- Blank company/role messages: "Company is required" / "Role is required".
- `DOMAIN_ERROR_MESSAGES` lives in `apps/web/src/lib/labels.ts`.
- `UpdateApplicationInputSchema` has **no defaults** (a partial update never resets `contacts`).
- **Clearing fields:** in an update patch, `null` = clear the field, absent/`undefined` = leave unchanged. Optional fields (`postingUrl, location, workMode, salary, followUpDate, notes`) are nullable in the update schema only; `updateApplication` deletes null keys. MemoryClient drops `undefined` keys after parsing. **Phase 2 API must accept the same null semantics.**
- `workMode` filter excludes applications with no work mode.
- Stats: median days to first response = mean of the two middle values for even counts; breakdowns ordered by `STATUSES`/`SOURCES`; buckets inclusive 0–3/4–7/8–14/15–30/31+; without a range `perWeek` spans the data's weeks; `recentActivity` ties → later history entry first, then application id.
- ApiClient errors: JSON `{code,message,issues?}` → `ClientError(status, code)`; non-JSON → `HTTP_<status>`; network failure → `ClientError(0,'NETWORK')`; `DELETE` expects 204.
- Posting URLs render as links only for `http://`/`https://`.
- ApplicationForm is keyed on application id; untouched fields resync from fresh data, edited fields keep user input.
- Windows note: Node ignores Olson `TZ` names here; use POSIX strings (`TZ=PST8PDT`) for timezone test runs.

### Deferred minor findings (for the final review to triage)

- Shared: query `page/pageSize` need `z.coerce` for the API; a few weak/vacuous tests (query tie-break & non-mutation, seed counts, stats tie-break and bucket edges, sankey aggregation ≥2, dates edges).
- Phase 2 contract: unknown status-entry id maps to 409 `ENTRY_NOT_FOUND` in memory mode — decide 404 vs 409 consistently with the API.
- Web: ApplicationForm `useDraft` — a field edited then reverted stays "touched", so a later timeline change to `dateApplied` leaves a stale value that Save would send; ApiClient raw `SyntaxError` on 2xx non-JSON body; seed `followUpDate` can precede `dateApplied`; global `retry: false` in App.tsx; search/URL sync races and `setParams` without `replace`; out-of-range page shows empty state; `useApplications` lacks keepPreviousData (table flicker); dialogs lack focus trap/Escape (confirm dialog); timeline add-default status computed at mount; edit sends `note: ''`; `JSON.stringify` change detection; several long JSX lines (no formatter configured).
