# DND Campaign

DND Campaign (DM Vault) is a web app for running tabletop campaigns. It manages characters, journal entries, player requests, glossary entries, quests, milestones, encounters, dungeons, maps, and fantasy calendars. Session workflows cover recordings, ElevenLabs transcription, versioned documents, n8n summaries, suggestions, and recap playback. Campaign membership controls access, with optional public campaign pages. Artifacts use local storage and media streams support HTTP ranges.

**Tech Stack**
1. Nuxt 4
2. Prisma (SQLite by default)
3. Nuxt UI

**Prerequisites**
1. Node.js
2. Yarn

**Setup**
```bash
yarn install
```

Installation generates the Prisma client and prepares Nuxt. The client lives in
`prisma/generated/` and is not tracked in Git. Generation requires no database
connection; builds also regenerate the client before compiling.

**Environment**
1. Database: `storage/db/dev.db`. Set `DATABASE_URL="file:../storage/db/dev.db"` in
   a local `.env` before running database commands or starting the app.
2. Storage root (local): `./storage`
3. Runtime config: `runtimeConfig.storage` (see `.env` if present)

**Database**
```bash
yarn db:migrate:dev
```

Development migrations also regenerate the client. After editing the Prisma schema
without running a migration, run `yarn db:generate`. Production migrations use
`yarn db:migrate:deploy`; Docker generates the client while building the image.

**Development**
Start the dev server on `http://localhost:3000`:
```bash
yarn dev
```

**Testing**
```bash
yarn test
yarn test:unit
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

