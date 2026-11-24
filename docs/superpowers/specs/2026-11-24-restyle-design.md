# applications-db: Visual Restyle (Phase 1 addition)

Date: 2026-11-24
Status: Approved by owner 2026-11-24
Parent spec: `2026-11-23-job-application-tracker-design.md`

## Intent
The working app looks plain and basic. The owner wants it **flat, simple, minimalistic, but pretty**, built on the standard component kit for this stack instead of hand-written class strings. It should look finished, in line with the parent spec's "no demo-ware" goal.

## Decided by the owner
- **Approach:** shadcn/ui (option 1 of 3).
- **Site colours:** maroon and white, with black where necessary, for the website itself: header, nav, buttons, links, focus rings, cards.
- **Charts** have their own colour palette, separate from the site colours.
- It becomes a task in **Phase 1**.

## Approaches considered
| Option | Trade-off | Outcome |
|---|---|---|
| **1. shadcn/ui themed maroon** | The standard kit for React + Tailwind. Component source is copied into the repo, so we own it. Radix-based dialogs bring a focus trap and Escape-to-close. Flat by default. | **Chosen** |
| 2. Plain Tailwind + our own small component set | No new libraries, but we would rebuild what shadcn already gets right (dialog accessibility) | Rejected |
| 3. A full UI library (MUI, Mantine) | Heavy, and its own styling system clashes with Tailwind; hard to make flat and minimal | Rejected |

## Goals
- Every existing screen restyled: layout/header, Dashboard, Applications list, Detail + timeline, quick-add, form, Statistics, Reports, Not found, empty/loading/error states.
- One theme defined once as CSS variables (shadcn tokens in `index.css` `@theme`/`:root`), with maroon as `--primary`.
- Status badges and charts share one muted status palette, so "Interview" is the same colour in a badge and in a chart.
- Dialogs (quick-add, delete/remove confirms) become shadcn `Dialog`/`AlertDialog`: focus trap, Escape, focus returns to the trigger. This closes the deferred findings on dialog accessibility.

## Non-goals
- Dark mode (light only for now; the tokens allow adding it later).
- New features, layout restructuring, or changed behaviour. This is purely visual, plus the dialog accessibility gained by the swap.
- A logo or brand mark beyond the app name.

## Anti-goals
- Any runtime network asset: no web fonts, no CDN. Keep the system font stack.
- Shadows, gradients and heavy rounding, which work against "flat".
- Behaviour regressions: existing tests stay green. Where markup changes, tests change only to match the new markup, never to drop a behaviour assertion.

## Constraints
- Tailwind 4, React 19, Vite 8 (already in place); icons stay `lucide-react`.
- Parent spec and CLAUDE.md rules still apply: strict TS, offline at runtime, storage chosen only by config.

## Look (my calls; owner may adjust)
```
┌────────────────────────────────────────────────────────────────────┐
│ ▌Applications   Dashboard  Applications  Statistics  Reports  [+ Add]│  ← maroon bar, white text;
└────────────────────────────────────────────────────────────────────┘    active link underlined white;
                                                                          "Add" = white button, maroon text
  Dashboard                                         (black heading)
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Active   │ │Interview │ │ Offers   │ │ Response │  ← white cards, 1px light-grey border,
  │ 24       │ │ 5        │ │ 1        │ │ 38%      │    no shadow; numbers black, labels grey
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  Follow-ups due                 Stale
  Acme · Frontend Eng  [Interview]  …                   ← muted status badge
  ─────────────────────────────────────────────────────
  Data source: In-memory (sample data, resets on reload)   (grey footer)
```
- **Maroon:** about `#7B1E2E` as primary, with a darker hover (about `#5E1622`); white text on maroon.
- **Neutrals:** white page background (or a very faint warm grey `#FAFAF9` behind white cards), near-black `#111` text, greys for borders and secondary text.
- **Shape:** small radius (about 6px), 1px borders, no shadows; generous whitespace.
- **Status palette (muted, shared by badges and charts):** applied = slate, screening = sky, interview = amber, offer = emerald, accepted = green, rejected = rose, ghosted = stone, withdrawn = zinc. Rose stays visibly distinct from the maroon chrome. Defined once (e.g. `lib/statusColors.ts`) and used by `StatusBadge` and `charts.ts`; source series use a separate muted categorical palette.
- **Form selects stay native `<select>` elements**, styled to match (shadcn ships a native-select style). This keeps keyboard/mobile behaviour and the existing tests. Radix Select gains nothing here.

## Left to the builder
- Exact shades, spacing and type scale within the above.
- Which shadcn components to add: expected Button, Card, Input, Label, Textarea, Badge, Table, Dialog, AlertDialog, plus native-select styling.
- Setup via the shadcn CLI (`npx shadcn@latest init/add`: setup-time download into the npm cache, nothing global) or by copying component source by hand; adds `@/` path alias, `clsx`, `tailwind-merge`, `class-variance-authority`, `radix-ui`/`@radix-ui/*` and `tw-animate-css` as needed.

## Testing
- The full web suite stays green; tests are adjusted only for markup.
- New: a dialog test (Escape closes quick-add; focus returns to the "Add application" button); a test that `StatusBadge` and the status donut use the same colour per status.
- Build and grep `dist` for external URLs (no runtime network assets).

## Placement
New **Task 15: Restyle with shadcn/ui** after Task 14 (backend gate). The old Task 15 (container, Compose, e2e) becomes **Task 16**, so the e2e smoke test runs against the final look.

---

## Also recorded: Phase 2 data export/import (parent spec amendment)
Owner request (2026-11-24): an option to **export and import data, in formats compatible with each other, for the DB setup only**. This reverses the parent spec's non-goal "Backups, data export/import".
- Available only when running on MongoDB (API mode with the `mongo` driver); not in in-memory mode.
- Proposed format: one JSON file with every application and its full status history, plus a format version. Import accepts exactly that format, validated with the shared Zod schemas before anything is written.
- **Open, decided at Phase 2 planning:** does import replace all data or merge (add new, skip existing ids)?
