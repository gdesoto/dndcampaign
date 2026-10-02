# Deployment and recovery

## Runtime and persistent data

The [Docker image](../docker/Dockerfile) builds the Nuxt production artifact and
starts it with [docker/start.sh](../docker/start.sh). Container defaults are:

| Setting | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/db/app.db` | Persistent SQLite database. |
| `NUXT_STORAGE_LOCAL_ROOT` | `/data/storage` | Local recordings and other artifacts. |
| `RUN_MIGRATIONS` | `1` | Run pending Prisma migrations before startup. |
| `NITRO_PORT` | `3000` | Application HTTP port. |

Startup creates the configured directories, runs `prisma migrate deploy` when
enabled, and executes `node .output/server/index.mjs`. The database and artifact
storage persist separately from build output; `.output` contains the runnable
application artifact.

## Prisma and SQLite

Prisma uses [prisma.config.ts](../prisma.config.ts), the `prisma-client` generator,
and generated files under `prisma/generated/`. Installation and builds generate
the client without requiring a database connection. Database operations and
server startup require `DATABASE_URL`.

Relative SQLite `file:` URLs resolve from `prisma/`; absolute paths stay
absolute. The [runtime client](../server/db/prisma.ts) uses the existing
[SQLite adapter](../server/db/sqlite-adapter.ts) with `unixepoch-ms` timestamps.
The adapter starts transactions with `BEGIN IMMEDIATE` to acquire the writer
lock before transaction reads and avoid read-to-write upgrade contention.

## Image publication

[deploy-docker.yml](../.github/workflows/deploy-docker.yml) builds and publishes
the image to GHCR on pushes to `master` or manual workflow dispatch. It uses
`docker/Dockerfile`, whose build stage runs `yarn build`. The workflow has no
separate lint, typecheck, or API-test stages.

## Recovery procedure

1. Pause deployments and identify the failed revision, previous known good image,
   applied migrations, environment configuration, and verified database backup.
   Database and artifact storage need to represent a consistent recovery state.
2. If migrations did not run, redeploy the previous compatible image with its
   matching configuration.
3. If migrations ran, check whether the previous application supports the applied
   schema before switching images. `prisma migrate deploy` does not undo schema
   changes. An incompatible schema requires the prepared recovery/backup process
   rather than simply replacing the image.
4. Use the checkout matching the recovery revision for Prisma validation,
   generation, migration status, and relevant application checks against the
   intended database. Production recovery does not require seeding.
5. After startup, verify login and authenticated `/api/auth/me`, campaign/session
   access, document reads/updates, and recording playback through
   `GET /api/artifacts/:artifactId/stream`, including a byte-range request.
   The recording metadata supplies its artifact ID. For affected provider
   workflows, also verify upload and transcription callback processing.
6. Record the recovered image, schema/database state, validation results, and
   incident cause before resuming deployments.
