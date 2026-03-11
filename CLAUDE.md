# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start dev server on http://localhost:3000
yarn build            # Build for production
yarn test             # Run full test suite (unit, api, nuxt)
yarn test:unit        # Unit tests only
yarn test:nuxt        # Nuxt/server tests only
yarn test:coverage    # Test coverage
yarn test:e2e         # Playwright end-to-end tests
yarn lint             # ESLint
yarn typecheck        # TypeScript type checking
npx prisma generate   # Regenerate Prisma client after schema changes
npx prisma migrate dev  # Run/create new migrations
```

## Architecture Overview

Full-stack **Nuxt 4** app with a Prisma/SQLite backend. Frontend and backend share code via the `shared/` directory.

- `app/` — Nuxt frontend (pages, components, composables, layouts, stores)
- `server/` — Nuxt server routes and services
- `shared/` — Zod schemas, TypeScript types, and utilities used by both sides
- `prisma/` — Schema (SQLite), migrations, and generated client
- `storage/` — Local file storage for recordings, artifacts, DB (`storage/db/dev.db`)

### Backend Pattern

Server API routes in `server/api/` should be **thin handlers** — validation, permission checks, and response shaping only. All business logic belongs in `server/services/`. Use `#server/...` and `#shared/...` path aliases in server code. Protected routes rely on `requireUserSession` (auto-imported from `#auth-utils`).

### Frontend Pattern

Pages in `app/pages/` should be **thin**; move repeated UI logic into components/composables. Use `useAsyncData`/`useFetch` for page-level data loading. Composables in `app/composables/` handle state orchestration. Auth state lives in the Pinia store at `app/stores/auth.ts`.

### Storage

Recordings and file artifacts use a pluggable storage abstraction in `server/services/storage/`. Local adapter writes to `./storage` (configurable via `.env` and `runtimeConfig.storage`). Media endpoints support HTTP 206 range requests for streaming.

### External Integrations

- **ElevenLabs** — audio transcription (webhook-based)
- **n8n** — session summarization via webhooks
- Both configured via `runtimeConfig` in `nuxt.config.ts`

## Key Conventions

### Styling

- Use **Nuxt UI semantic classes** (`text-highlighted`, `text-muted`, `text-dimmed`, `border-default`, `bg-accented`) instead of raw token expressions like `text-[var(--ui-text-highlighted)]`.
- Theme overrides live exclusively in `app/app.config.ts`. Only use documented Nuxt UI config keys (`defaultVariants`, `slots`, `variants`, `compoundVariants`). Verify key names with the Nuxt UI MCP tool before adding new overrides.
- Prefer `UPage`, `UPageHeader`, `UCard` for page structure; favor Nuxt UI primitives before custom markup.

### API Design

- Resource-first namespace paths: `/api/campaigns/:campaignId/journal/entries` (not `/api/campaigns/:campaignId/journal-entries`).
- Single-model updates via `PUT`/`PATCH` on the canonical endpoint with model attributes.
- Use typed `action` payloads for state transitions (e.g., `PATCH /api/encounters/:id` with `{ action: 'start' }`).
- Prefer endpoint consolidation over narrow one-off routes.
- **Any API route or payload change must also update `public/openapi.json`.**

### Components

- `script setup lang="ts"` with strongly typed props and emits.
- Use `app/components/shared/ConfirmActionPopover.vue` for destructive-action confirmations.
- For `UTable` customization, prefer `#<column>-header` and `#<column>-cell` slots over render functions.

### Forms

- Handle loading, empty, and error states explicitly. Prevent double-submit during async actions.

## Testing

Three Vitest projects (configured in `vitest.config.ts`):
- **unit** — `test/unit/*.test.ts`, Node environment
- **api** — `test/api/*.test.ts`, Node environment with global setup
- **nuxt** — `test/nuxt/*.test.ts`, Nuxt + Happy DOM environment

E2E tests use Playwright (`test/e2e/`).

## Planning Docs

`dev_plan/` contains milestone checklists and design documents. Consult `dev_plan/DeveloperBuildPlan.md` and `dev_plan/SoftwareDesignDocument.md` for feature scope and architecture decisions.
