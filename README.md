# DND Campaign

DND Campaign is a Nuxt 4 web app for running tabletop campaigns. It manages campaigns, sessions, glossary entries, quests, milestones, and recordings. Recordings are stored via a storage abstraction (local by default) and streamed with range support for media playback.

**Tech Stack**
1. Nuxt 4 (server routes)
2. Prisma (SQLite by default)
3. Nuxt UI

**Prerequisites**
1. Node.js
2. Yarn

**Setup**
```bash
yarn install
```

**Environment**
1. Database: `prisma/db/dev.db`
2. Storage root (local): `./storage`
3. Runtime config: `runtimeConfig.storage` (see `.env` if present)

**Database**
```bash
npx prisma generate
npx prisma migrate dev
```

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

