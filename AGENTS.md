# AGENTS

## Overview
DND Campaign is a Nuxt 4 web app for running tabletop campaigns. It manages campaigns, sessions, glossary entries, quests, milestones, and recordings. The backend uses Nuxt server routes and Prisma (SQLite by default). Recordings are stored via a storage abstraction (local by default) and streamed with range support for media playback.

## Project Planning Docs
- `dev_plan/DeveloperBuildPlan.md` and `dev_plan/SoftwareDesignDocument.md` define goals, milestones, and scope.
- Milestone checklists live in `dev_plan/` (e.g. `MilestoneA_Checklist.md`, `MilestoneB_Checklist.md`, `MilestoneC_Checklist.md`).

## Dev Environment Tips
- Node + Yarn: use `yarn` for installs and scripts.
- Prisma: migrations live in `prisma/migrations`. The SQLite DB is `prisma/db/dev.db`.
- Storage: local storage root defaults to `./storage` (see `.env` and `runtimeConfig.storage`).
- Auth: routes rely on `requireUserSession` auto-imported from `#auth-utils`.
- Server imports: use `#server/...` and `#shared/...` aliases in server code.

## Nuxt + Nuxt UI Tools
- When unsure about component APIs or available props, consult the Nuxt UI docs (UPage, UHeader, UMain, UCard, etc.).
- Use Nuxt docs for config/runtime questions and module behavior.
- Favor Nuxt UI primitives for layout and consistent styling before custom markup.

## Code Style
- TypeScript first; prefer explicit types for API payloads and service inputs.
- Keep server logic in `server/services`, thin handlers in `server/api`.
- Use Nuxt UI components for layout and controls; theme overrides live in `app/app.config.ts`.
- Prefer `UPage`, `UHeader`, `UMain`, and `UCard` for page structure.
- Keep Tailwind classes consistent.

## Testing
- Unit tests: `yarn test:unit`
- Nuxt/server tests: `yarn test:nuxt`
- Full suite: `yarn test`
- Coverage: `yarn test:coverage`

## Common Commands
- Dev server: `yarn dev`
- Prisma generate: `npx prisma generate`
- Prisma migrate (dev): `npx prisma migrate dev`
