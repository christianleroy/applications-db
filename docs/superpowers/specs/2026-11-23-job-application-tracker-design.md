# applications-db — Job Application Tracker Design

Date: 2026-11-23
Status: Draft, awaiting approval

## 1. Intent

A personal job-application tracker for **candidates** (not employers). The user logs each application they send and the app turns that log into a dashboard, statistics, search, and date-ranged chart reports.

Why: the owner is experimenting with agentic AI coding, but the result must be **genuinely functional** — a tool they would actually rely on during a job search, not a demo.

## 2. Goals, non-goals, anti-goals

**Goals**
- Fast, low-friction entry and update of applications.
- A status history per application, so statistics reflect what really happened over time.
- Dashboard, statistics, search, and reports with charts (including a Sankey flow) over a chosen date range.
- Three separate components — frontend, Node.js backend, MongoDB — each in its own container, started together with Docker Compose.
- Storage selectable in configuration (in-memory or MongoDB), failing fast when MongoDB is chosen but unreachable.

**Non-goals**
- Login, accounts, multi-user, permissions.
- Cloud hosting, sync between devices.
- Backups, data export/import, moving data between storage kinds.
- Choosing or switching storage from inside the app.
- Email/calendar integration, job-board scraping, company-logo lookups, AI features.
- Mobile app (responsive web is enough).

**Anti-goals** (failure even if it "works")
- Silently running on the wrong storage, or on empty data, when the configured one is unavailable.
- Needing an internet connection at runtime, once set up (CDN fonts/scripts, external APIs).
- Demo-ware: buttons or screens that look finished but aren't wired up.

## 3. Constraints

- Single user, installed locally. **Internet is needed only to set up** (npm install, pulling/building Docker images). After that the app runs fully offline: no CDN assets at runtime (fonts, icons, chart libraries are bundled into the build), no external API calls. Internet is needed again only for setup-type work such as updating dependencies or rebuilding images.
- TypeScript throughout.
- Each component runs in its own container; `docker compose up` brings up the whole stack.
- Build order: **frontend first** against an in-memory data layer, shaped exactly like the future REST API; then backend + MongoDB.

## 4. Approaches considered

| Option | Summary | Trade-off |
|---|---|---|
| **A. React + TS (chosen)** | React/Vite, TanStack Query, React Router, Tailwind, ECharts; Fastify + Mongoose backend | Largest ecosystem, best fit for AI-assisted coding; you assemble the pieces yourself |
| B. Vue 3 + TS | Vue/Vite, Pinia, ECharts; same backend | Less boilerplate, gentler; smaller ecosystem, less AI training exposure |
| C. Angular | Batteries-included, DI suits the swappable service layer | Heavier, more ceremony, slower iteration at this size |
| Rejected: Next.js / full-stack frameworks | — | Merges frontend and backend, contradicting the three-component requirement; SSR adds nothing offline |

**Chosen by the owner: A, with a shared contract package** (below).

## 5. Architecture

### 5.1 Repository layout (npm workspaces monorepo)

```
apps/
  web/        React frontend (container: nginx serving the static build)
  api/        Fastify backend (container: Node 22 LTS)
packages/
  shared/     Zod schemas, TS types, enums, and pure stats/report functions
docker-compose.yml
```

`packages/shared` is the single source of truth for the data shape. Both the frontend's in-memory data layer and the API validate against it, so drift between them is a compile/validation error.

### 5.2 Storage configuration (in code, not in the app)

Storage is chosen by configuration only; the UI has no setting for it. Each app has one typed config module that reads environment variables, applies defaults, validates them with Zod at startup, and refuses to start on an invalid value.

- **Frontend** — `apps/web/src/config.ts`, `VITE_DATA_SOURCE=memory | api` (build-time; Compose passes it as a build arg).
  - `memory`: in-browser store seeded with realistic sample data; resets on reload.
  - `api`: talks to the backend over REST.
- **Backend** — `apps/api/src/config.ts`, `STORAGE_DRIVER=memory | mongo`, plus `MONGO_URL` (required when `mongo`).
  - `memory`: for tests and running the API without a database.
  - `mongo`: the normal mode.

Both sides use a repository interface (`list / get / create / update / delete / addStatus / updateStatus / removeStatus`) with one implementation per storage kind, selected once at startup from config. Screens and routes never know which is in use.

### 5.3 Fail fast

- **API, `mongo` driver:** connect *before* the HTTP server starts listening, with a short server-selection timeout (5 s, configurable). On failure, log one clear error naming the host and exit with a non-zero code. No fallback to memory, no endless retries.
- **API, connection lost after startup:** requests return `503` with a clear message; `GET /health` reports unhealthy. (Builder's call: the Mongo driver's own reconnect handles recovery.)
- **Compose:** `mongo` has a healthcheck and `api` uses `depends_on: condition: service_healthy`, so a normal `docker compose up` doesn't fail by racing the database. `api` uses `restart: "no"` so a fail-fast exit stays visible instead of looping.
- **Frontend, `api` mode:** on load it calls `/api/health`; if the API or its database is unreachable, it shows a full-screen "cannot reach the backend" error with a retry button — never an empty dashboard that looks like "no applications".

### 5.4 Containers

- `web` — nginx serving the build; proxies `/api` to `api` so the browser has one origin (no CORS).
- `api` — Fastify app.
- `mongo` — MongoDB 8, data in a **named volume** so it survives restarts and `docker compose down` (only `down -v` deletes it; the README notes this).
- Default `docker compose up` = full stack (`web` built in `api` mode, `api` in `mongo` mode). A Compose profile or override file runs `web` alone, built in `memory` mode.
- Default host port: web on `localhost:8080`. Only `web` is exposed to the host; `api` and `mongo` stay on the internal network.

## 6. Data model

**Application**

| Field | Type | Notes |
|---|---|---|
| id | string | UUID v4 in every storage mode (Mongo `_id` is that string) |
| company | string | required |
| role | string | required |
| postingUrl | string? | |
| location | string? | free text |
| workMode | `onsite` \| `hybrid` \| `remote` | |
| salary | `{ min?, max?, currency, period: year\|month\|hour }`? | |
| source | enum: `linkedin`, `indeed`, `company_site`, `referral`, `recruiter`, `job_board`, `other` | |
| dateApplied | date | required; the date used for date-range filtering. Always equal to the date of the first history entry — editing either updates the other |
| statusHistory | `{ id, status, date, note? }[]` | at least one entry; first is `applied` and cannot be deleted. Entries can be **added, edited (status/date/note) and deleted**; the list is kept sorted by date |
| status | derived | last entry of `statusHistory`; stored denormalized for querying |
| followUpDate | date? | drives "follow-ups due" on the dashboard |
| contacts | `{ name, role?, email?, phone?, notes? }[]` | |
| notes | string? | free text, searchable |
| createdAt / updatedAt | date | |

**Statuses:** `applied`, `screening`, `interview`, `offer`, `accepted`, `rejected`, `ghosted`, `withdrawn`. Any status may follow any other (real life is messy); the UI suggests the usual next step. `ghosted` is set manually; the dashboard flags applications with **no status change in 21 days** as stale candidates for it.

**Definitions** (used identically by dashboard, statistics and reports; implemented once in `packages/shared`):
- **Active** = current status is `applied`, `screening`, `interview` or `offer`. Finished = `accepted`, `rejected`, `ghosted`, `withdrawn`. Stale and follow-up flags only apply to active applications.
- **Responded** = the history ever contains a status other than `applied`, `ghosted`, `withdrawn`. An application that reached screening and was later withdrawn counts as responded.
- **Response rate** = responded ÷ all applications in scope.
- **Days to first response** = date of first "responding" history entry − `dateApplied`.

## 7. API (REST, JSON, under `/api`)

- `GET /applications?q=&status=&source=&workMode=&from=&to=&sort=&page=&pageSize=` — search + filter + paginate.
- `GET /applications/:id`, `POST /applications`, `PATCH /applications/:id`, `DELETE /applications/:id`
- `POST /applications/:id/status` — add a status-history entry; `PATCH` / `DELETE /applications/:id/status/:entryId` — edit or remove one. Every change re-sorts the history and recomputes `status` and `dateApplied`.
- `GET /stats` (all-time) and `GET /reports?from=&to=`.
- `GET /health` — reports API and storage health (used by the frontend's startup check).

**Stats and reports are computed by pure functions in `packages/shared`** over a list of applications. The API fetches the applications in range and runs those functions; memory mode runs the same functions in the browser. Expected data volume is hundreds to a few thousand records, so no aggregation pipeline is needed.

## 8. Screens

```
Dashboard   │ "right now": KPI tiles (active, in interview, offers, response rate),
            │ follow-ups due, stale applications, recent activity
Applications│ list/search: text search (company, role, notes, contacts) + filters
            │ (status, source, work mode, date applied) → table → detail/edit
Detail      │ all fields, editable status timeline (add/edit/delete), contacts
Statistics  │ all-time numbers in depth (same metrics as reports, no range)
Reports     │ date-range picker (presets: last 30/90 days, this year, custom)
            │ → charts → export PNG (per chart) / PDF (whole report, via print)
```

The active data source is shown discreetly (e.g. in the footer) for orientation only; it is not changeable in the UI.

Quick-add is a priority: a short form (company, role, source, date — defaults to today) reachable from every screen; the remaining fields are optional and editable later.

## 9. Reports — charts

All filtered by `dateApplied` within the selected range. Library: **Apache ECharts** (bundled).

- **Sankey — forward-only pipeline.** Each application contributes one forward path showing how far it got; backward moves are ignored, so the chart never has loops.
  - Progress stages in order: `applied` → `screening` → `interview` → `offer` → `accepted`.
  - Walk the history in date order and keep a status only if it is further along than everything before it. Skipped stages are not filled in (applied → interview is drawn directly).
  - If the current status is `rejected`, `ghosted` or `withdrawn`, the path ends at that node, attached after the furthest stage reached.
  - An application still at `applied` ends at a "No response yet" node.
- **Donut — current status breakdown.**
- **Donut — applications by source.**
- **Bar/line — applications sent per week.**
- **Bar — response rate by source** (using the "responded" definition above).
- **Histogram — days from application to first response.**

## 10. Testing

- `packages/shared`: unit tests (Vitest) for schemas and every stats/report function, including Sankey path building with backward moves and skipped stages.
- `apps/api`: route tests via Fastify `inject` with the memory driver; repository tests against a real Mongo (the Compose `mongo` service or a test container); a fail-fast test (unreachable `MONGO_URL` → non-zero exit before listening); config validation tests.
- `apps/web`: component tests (Vitest + Testing Library) for forms, filtering, and the backend-unreachable screen; a small Playwright smoke suite (add, search, change status, view report) in memory mode.

## 11. Phases

1. **Shared + frontend** — `packages/shared`, all screens, in-memory data layer with seed data, config module, `web` container, Compose running `web` in memory mode.
2. **Backend** — Fastify API with both storage drivers, config + fail-fast startup, `api` and `mongo` containers, frontend `api` data layer and health check, full-stack Compose default.
3. **Polish** — loose ends, README (setup, configuration, volume warning).

## 12. Left to the builder

- Component library choice on top of Tailwind (e.g. headless/shadcn-style), visual design, icons (bundled).
- Exact seed-data content.
- Pagination defaults, sort options, table column choices.
- Error/empty/loading states (must exist; design is open).
- Lint/format tooling, CI.
