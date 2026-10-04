# DND Campaign

DND Campaign (DM Vault) is a web app for running tabletop campaigns. It manages characters, journal entries, player requests, glossary entries, quests, milestones, encounters, dungeons, maps, and fantasy calendars. Session workflows cover recordings, ElevenLabs transcription, versioned documents, n8n summaries, suggestions, and recap playback. Campaign membership controls access, with optional public campaign pages. Artifacts use local storage and media streams support HTTP ranges.

**Tech Stack**

1. Nuxt 4
2. Drizzle ORM with SQLite and better-sqlite3
3. Nuxt UI

**Prerequisites**

1. Node.js 24
2. Yarn

**Setup**

```bash
yarn install
```

Installation prepares Nuxt. Installation and builds require no live database or
ORM client generation. The database schema lives in `server/db/schema.ts`;
versioned SQL migrations and compatibility metadata live in `drizzle/`.

**Environment**

1. Database: `storage/db/dev.db`. Set `DATABASE_URL="file:../storage/db/dev.db"` in
   a local `.env` before running database commands or starting the app. Relative
   `file:` paths retain their historical resolution from the `prisma/` directory;
   absolute paths stay absolute.
2. Storage root (local): `./storage`
3. Runtime config: `runtimeConfig.storage` (see `.env` if present)

**Database**

Before upgrading an existing database, create a backup:

```bash
node scripts/database.mjs backup storage/backups/dev-before-drizzle.db
```

Initialize or upgrade the database, then verify it:

```bash
yarn db:migrate:dev
node scripts/database.mjs status
node scripts/database.mjs check
```

The database CLI loads the local environment and requires `DATABASE_URL`.
`migrate` initializes a fresh database, adopts a supported existing Prisma database,
and applies pending Drizzle migrations. `check` verifies compatibility without
applying migrations; `status` reports migration state. `backup` writes a consistent
SQLite backup using the backup API. Generate reviewed SQL changes with
`yarn db:generate`, then apply them with `yarn db:migrate:dev` or
`yarn db:migrate:deploy`. These commands do not generate an ORM client.

Back up an existing database and its matching artifacts before upgrading. Adoption
supports the exact 34-migration Prisma history frozen from revision `d06b7ec`,
checks its history and schema, normalizes supported text timestamps to epoch
milliseconds, and records the exact `0000` legacy baseline. It then applies
`0001_epoch_timestamp_defaults`, rebuilding 50 tables while retaining their data
and IDs to give SQL timestamp defaults the same millisecond encoding. A verified
backup is required before this in-place upgrade. See
[deployment and recovery](docs/DeploymentRecovery.md) for rehearsal and rollback.

**Development**

Start the dev server on `http://localhost:3000`:

```bash
yarn dev
```

**Testing**

```bash
yarn lint
yarn typecheck
yarn test
yarn test:unit
yarn test:api
yarn test:nuxt
yarn test:coverage
```

**Documentation**

- [Application documentation](docs/README.md): how the implemented system works, organized by feature and operations.
- [Development scratchpad](dev_plan/README.md): feature planning, implementation notes, investigations, and follow-ups.
- [OpenAPI contract](public/openapi.json): canonical API paths and payloads.

Contributor and agent conventions live in [AGENTS.md](AGENTS.md),
[CLAUDE.md](CLAUDE.md), and [StyleGuide.md](StyleGuide.md). Settled system
explanations from development plans become maintained application documentation
in `docs/` as features are implemented.
