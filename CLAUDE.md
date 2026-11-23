# applications-db

Personal job-application tracker: an npm-workspaces monorepo with a React web app and a pure shared domain package (an API app comes in a later phase).

## Where to look
- Design spec: `docs/superpowers/specs/2026-11-23-job-application-tracker-design.md`
- Implementation plans: `docs/superpowers/plans/`

## Layout
- `packages/shared` - `@applications-db/shared`: enums, zod schemas, pure domain logic. Consumed as TypeScript source (no build step).
- `apps/web` - React/Vite frontend (added in phase 1).
- `apps/api` - backend (later phase).

## Commands
- `npm install` - install all workspaces
- `npm test` - run tests in every workspace
- `npm run typecheck` - type-check every workspace
- `npm run dev` - start the web app dev server
- `docker compose up --build` - run the full stack (web on port 8080)

## House rules
- Domain logic lives in `packages/shared` and is pure: functions never read the clock; pass `today: IsoDate` or `now: string` in.
- Domain dates are `YYYY-MM-DD` strings; `createdAt`/`updatedAt` are ISO datetimes. IDs are UUID v4.
- Storage is chosen by configuration (`VITE_DATA_SOURCE=memory | api`), never by a UI control.
- No runtime network assets: no CDNs, web fonts or remote images. System font stack; icons from a bundled npm package.
- TypeScript `strict`; no `any` in exported signatures.
- TDD: write the failing test first, watch it fail, then implement.
- Use the superpowers workflow (brainstorm, plan, execute) for new features.
