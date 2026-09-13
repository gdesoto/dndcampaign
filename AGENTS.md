# AGENTS

Source of truth for agent guidance in this repo. `CLAUDE.md` points here and adds Claude Code specifics only.

## Overview
DND Campaign (DM Vault) is a Nuxt 4 web app for running tabletop campaigns: campaigns, sessions, journal, glossary, quests, milestones, characters, encounters, dungeons, maps, calendar, recordings, and public campaign pages. The backend is Nuxt server routes plus Prisma on SQLite. Recordings and artifacts go through a storage abstraction (local by default) and stream with HTTP range support.

## Where things live
- `app/` — pages, components, composables, layouts. No `stores/` directory; state lives in composables.
- `server/api/` — thin route handlers. `server/services/` — business logic. `server/utils/` — auth, validation, http, multipart helpers. `server/error-handler.ts` — API error envelope.
- `shared/` — Zod schemas, types, and utilities used by both sides.
- `prisma/` — schema, migrations, generated client. The dev database is `storage/db/dev.db` (`DATABASE_URL` in `.env`).
- `storage/` — local files (git-ignored).
- `public/openapi.json` — hand-maintained API contract.

## Docs to consult
- `dev_plan/DeveloperBuildPlan.md` and `dev_plan/SoftwareDesignDocument.md` — goals, milestones, scope. Milestone checklists are under `dev_plan/initial_milestones/`; feature plans under the other `dev_plan/` folders.
- `docs/SessionWorkspaceOwnership.md` — session workspace state ownership contract; read before touching session pages or composables.
- `docs/CodeSimplificationPlan.md` — open cleanup tickets with ratings; check it before starting refactors.
- Frontend: see "Frontend conventions" below for which guide wins.

## Commands
- `yarn dev`, `yarn build`, `yarn lint`, `yarn lint:fix`, `yarn typecheck`
- Tests: `yarn test` (all three Vitest projects), `yarn test:unit`, `yarn test:api` (real dev server + SQLite), `yarn test:nuxt` (components, Happy DOM), `yarn test:coverage`, `yarn test:e2e` (Playwright)
- Database: `yarn db:migrate:dev`, `yarn db:migrate:deploy`, `yarn db:migrate:status`, `yarn db:seed`; `npx prisma generate` after schema changes

## Backend conventions
- Handlers in `server/api/` do validation, permission checks, and response shaping only. Business logic belongs in `server/services/`. Use `#server/...` and `#shared/...` aliases in server code.
- **Errors are thrown, not returned.** Throw `apiError(statusCode, code, message, fields?)` from `server/utils/http.ts` anywhere on the server; `server/error-handler.ts` shapes anything thrown under `/api/` into `{ data: null, error: { code, message, fields } }`. Success responses return `ok(data)`. `requireUserSession`, `requireCampaignPermission`, `requireSystemAdmin`, `validateBody`, `validateQuery`, `validateInput`, `routeParams`, and `enforceRateLimit` return their value or throw; never branch on `.ok`. A `catch` that remaps errors must first rethrow H3 errors: `if (isError(error)) throw error`.
- **Authorization lives in the handler.** Campaign-scoped routes call `requireCampaignPermission(event, campaignId, permission)` once and pass the returned `access` or `actor` (`{ userId, access }`) into services. Services take a trusted `campaignId` and never re-resolve membership. Routes keyed by a child id (`/encounters/:id`, `/sessions/:id`, `/documents/:id`) scope the lookup with `buildCampaignWhereForPermission` instead. Use `assertCampaignPermission(access, permission)` when one handler branches on the action.
- Multipart uploads use `readSingleFileUpload` / `readMultipartUpload` from `server/utils/multipart.ts`. Caption conversion uses `toVtt` from `shared/utils/transcript.ts`. Do not add another Busboy loop or VTT converter.
- Route params come from `routeParams(event, 'campaignId', ...)`; do not add "id is required" guards.

## API design
- Resource-first namespace paths: `/api/campaigns/:campaignId/journal/entries`, not `/journal-entries`. Shallow nesting is fine: list and create under the parent, update and delete on `/quests/:questId`.
- Single-model updates via `PUT`/`PATCH` on the canonical endpoint with model attributes.
- State transitions and business operations use typed `action` payloads on the canonical endpoint, validated with a `z.discriminatedUnion('action', ...)` (see the journal entry PATCH), not hand-parsed strings.
- Prefer endpoint consolidation over narrow one-off routes. A dedicated action endpoint is acceptable only when it must coordinate several models.
- **Any route or payload change updates `public/openapi.json` in the same change set.** Add or extend tests before changing a payload shape.

## Frontend conventions
- **Which guide wins.** The `nuxt-ui-guidelines` skill governs interaction, layout, density, forms, tables, confirmation, feedback, navigation, and accessibility. The `dmvault-style-guide` skill and `theme-guide.md` govern DM Vault identity only: palette, fonts, radii, ornament, and the parchment light mode. `StyleGuide.md` holds project-specific component contracts. Where they conflict, the order is: explicit user instruction, nuxt-ui-guidelines, StyleGuide.md, dmvault/theme-guide.
- Pages in `app/pages/` stay thin. Extract components when a page grows; extract a composable only when a second page needs the logic. Load page data with `useAsyncData`/`useFetch`. Auth state comes from `useAuth()`.
- Use Nuxt UI primitives before custom markup; `UPage`, `UPageHeader`, `UCard` for page structure. Theme overrides live in `app/app.config.ts` using documented keys only (`defaultVariants`, `slots`, `variants`, `compoundVariants`); verify keys with the Nuxt UI docs tools before adding overrides.
- Use Nuxt UI semantic classes (`text-highlighted`, `text-muted`, `text-dimmed`, `border-default`, `bg-accented`) rather than raw token expressions like `text-[var(--ui-text-highlighted)]`.
- Confirmations: `SharedConfirmActionPopover` by default for irreversible actions; `SharedConfirmActionModal` only when the confirmation must carry a count, a cascade, or a pending state. Reversible actions confirm nothing and offer Undo.
- For `UTable` customization, prefer `#<column>-header` and `#<column>-cell` slots over render functions.
- Handle loading, empty, no-matches, and error states explicitly; prevent double submit.

## Component naming
- Use Nuxt's auto-imported names in templates. The name is the directory path under `app/components/` plus the filename: `app/components/shared/ConfirmActionModal.vue` is `<SharedConfirmActionModal />`. Correct the template name rather than adding an explicit import. Check `.nuxt/components.d.ts` when unsure.
- Let directories supply domain context and keep filenames focused on the role; avoid repeating directory words (`campaign/templates/List.vue` → `CampaignTemplatesList`, not `campaign/templates/CampaignListTemplate.vue`). Update template references, imports, and tests when moving or renaming.
- `script setup lang="ts"` with explicitly typed props and emits. TypeScript first for API payloads and service inputs.

## Testing
Three Vitest projects in `vitest.config.ts`:
- **unit** — `test/unit/*.test.ts`, plain Node (no `#server` alias; keep pure modules free of server-only imports).
- **api** — `test/api/*.test.ts`, starts a real dev server on port 4181 with its own SQLite DB. Files run in parallel against one DB, so an occasional SQLite busy timeout on dungeon routes is a known flake; rerun once before investigating.
- **nuxt** — `test/nuxt/*.test.ts`, Nuxt + Happy DOM.
E2E tests are Playwright specs in `test/e2e/`.

## Making changes
- After JavaScript, TypeScript, or Vue changes, `yarn lint` and `yarn typecheck` must pass.
- Run the tests that cover the changed files; run `yarn test` when a change is broad.
- Diagnose root causes before adding workarounds; document the cause if a workaround is unavoidable.
- Prefer deleting complexity over rearranging it. Reuse existing services, utils, and components before adding a layer.
