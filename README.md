# DND Campaign

DND Campaign is a web app for running tabletop campaigns. It manages campaigns, sessions, glossary entries, quests, milestones, and recordings. Recordings are stored via a storage abstraction (local by default) and streamed with range support for media playback.

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

