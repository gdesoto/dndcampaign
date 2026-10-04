# Deployment and recovery

## Runtime and persistent data

The [Docker image](../docker/Dockerfile) builds the Nuxt production artifact and
starts it with [docker/start.sh](../docker/start.sh). Container defaults are:

| Setting | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/db/app.db` | Persistent SQLite database. |
| `NUXT_STORAGE_LOCAL_ROOT` | `/data/storage` | Local recordings and other artifacts. |
| `RUN_MIGRATIONS` | `1` | Apply database migrations before startup. |
| `NITRO_PORT` | `3000` | Application HTTP port. |

Keep the existing `/data` mount. Startup creates the configured directories,
executes `node scripts/database.mjs migrate`, then runs
`node .output/server/index.mjs`. With `RUN_MIGRATIONS` set to a value other than
`1`, startup executes `node scripts/database.mjs check`; a database requiring
migration or adoption must pass readiness before the app listens. Existing
storage and ElevenLabs environment aliases remain supported by the startup script.

The database and artifact storage persist separately from build output. The image
includes `.output`, the database CLI, migration modules, dependencies, and
`drizzle/`; it requires no Prisma client, generator, or migration executable.
Installation and image builds require no live database.

## Drizzle and SQLite

The schema is [server/db/schema.ts](../server/db/schema.ts), and the runtime
connection is [server/db/client.ts](../server/db/client.ts). Drizzle uses
better-sqlite3. Explicit synchronous transactions use `BEGIN IMMEDIATE` to acquire
the writer lock before transaction reads. Transaction callbacks cannot await
asynchronous work. IDs, table names, column names, and artifact references retain
their existing contracts.

Relative SQLite `file:` URLs continue to resolve from the repository's `prisma/`
directory, so existing `file:../storage/db/dev.db` configuration remains valid.
Absolute paths stay absolute. Writes encode dates as UTC epoch milliseconds;
SQL timestamp defaults use `CAST(unixepoch('subsec') * 1000 AS INTEGER)` so
default-generated and explicitly written dates have the same encoding. SQL
defaults take precedence over Drizzle JavaScript default functions; retaining
`CURRENT_TIMESTAMP` would create mixed text/numeric values. Column codecs read
compatible historical numeric or text dates. JSON literal null
and SQL NULL remain distinct at the storage boundary.

The plain Node database CLI requires `DATABASE_URL` and loads the local environment:

```bash
node scripts/database.mjs migrate
node scripts/database.mjs status
node scripts/database.mjs check
node scripts/database.mjs backup /safe/location/app.db
```

`migrate` initializes fresh databases and applies reviewed versioned SQL in
`drizzle/`. `status` reports migration state, and `check` verifies that the database
is ready without applying pending migrations. `backup` uses SQLite's backup API
for a consistent database snapshot, including committed WAL content. It does not
back up artifacts or environment secrets. Use `yarn db:generate` after editing the
schema to generate SQL for review; `yarn db:migrate:dev` and
`yarn db:migrate:deploy` apply migrations. The migration runner preserves the
legacy Prisma migration journal and records the adopted Drizzle baseline.

## Existing-volume upgrade

Adoption supports the exact legacy schema and complete 34-migration Prisma history
frozen from repository revision `d06b7ec`. The compatibility manifest is
`drizzle/legacy-prisma.json`. Adoption verifies completed migration history and
schema before making changes. Supported valid UTC text timestamp values are normalized to
epoch milliseconds so SQL ordering and filtering use a consistent encoding. The
runner adopts the exact `0000` legacy baseline, then applies
`0001_epoch_timestamp_defaults`, which rebuilds 50 application tables (all except
`ApiKeyCampaign`) to install millisecond SQL timestamp defaults. Application data,
record IDs, indexes, and relationships are retained. This upgrade changes physical
table definitions and requires a verified backup before running in place.

For this compatibility migration, the runner disables foreign-key enforcement
before opening the immediate transaction, normalizes timestamps, registers the
baseline, applies the migration, and verifies foreign keys and database integrity
before commit. It restores foreign-key enforcement on the connection afterward.
A failed adoption or verification rolls back the transaction. Rehearse this
operation on a restored copy before upgrading the deployment volume.
Unsupported, partial, failed, or drifted histories must be investigated before
startup; do not bypass validation by deleting migration journals.

This procedure describes the upgrade path. It does not certify that a production
volume has been rehearsed or upgraded.

1. Record the old and new immutable image digests, runtime configuration, database
   migration status, and artifact mount. An older installation must first reach
   the supported final Prisma schema using its matching release.
2. Rehearse the new image on a restored database and artifact copy. Disable provider
   callbacks and external jobs in that rehearsal. Check table counts, IDs, dates,
   JSON/nulls, relationships, login, campaign permissions, and representative
   application workflows. Measure migration time and verify repeat startup.
3. Put the deployment into maintenance, stop app writers and uploads, and drain
   in-flight jobs. Plan callback retry or replay before accepting provider traffic.
4. Create and verify a consistent database backup with the backup CLI or a cold
   snapshot after all connections close. Save the matching artifact snapshot and
   configuration securely. Never copy only a live SQLite main file and assume
   WAL writes are included.
5. Start the pinned new image against the existing `/data` mount with migrations
   enabled. If compatibility validation or migration fails, keep traffic closed
   and preserve diagnostics and the failed state for investigation.
6. Verify login and `/api/auth/me`, owner/member/public/API-key access, session and
   document editing, encounter ordering and turns, map/dungeon assets, and media
   playback with a byte-range request to `GET /api/artifacts/:artifactId/stream`.
   Check provider processing safely, restart once, then reopen traffic and jobs.
7. Retain the old image and verified backup through the observation period. Record
   migration duration, checks, and any anomalies.

## Image publication

[deploy-docker.yml](../.github/workflows/deploy-docker.yml) runs lint, typecheck,
all Vitest projects, and a Nuxt build before building and publishing to GHCR on
pushes to `master` or manual dispatch. Each publication has a revision tag
`sha-<commit>` and `latest`. Record the resolved immutable digest for deployment
and recovery; `latest` can move. The Docker build independently runs `yarn build`.

The existing Unraid deployment is updated manually after publication. During the
maintenance window, use Unraid's container update/recreate operation to install
the new image while preserving the `/data` mount and environment. A standalone
`docker pull` followed by `docker restart` does not change an existing container's
image. Verify the replacement container's image ID and startup migration result
before reopening traffic.

## Recovery procedure

1. Pause deployments and writers. Identify the failed revision, previous image,
   applied migrations, matching configuration, and verified database/artifact
   backup. Preserve the failed database and diagnostics before restoring.
2. Switch to the old image against the same database only if rehearsal proved that
   exact release can read and write the adopted schema and normalized values.
   Migration commands do not reverse an upgrade. Otherwise restore the prepared
   pre-upgrade database, matching artifacts, and configuration while offline.
3. Close every database connection before replacing the SQLite file. Preserve or
   quarantine the failed main file and its `-wal`/`-shm`/journal sidecars together;
   never let stale sidecars attach to the restored file. Restore the verified
   SQLite database file with the correct ownership and permissions. The backup
   is a database file, not a SQL text dump.
4. Use the checkout and CLI matching the recovery image to inspect migration state
   and readiness against the intended file. Production recovery does not require
   seeding. An incompatible or unsupported schema needs a reviewed migration on a
   separate restored copy and another rehearsal before cutover.
5. Verify login, permissions, document reads and updates, map/dungeon assets,
   encounters, recordings and recap range playback, and relevant provider
   callbacks before reopening traffic.
6. Record the recovered image, database state, validation, and incident cause.

Restoring a pre-upgrade backup after traffic has resumed discards later writes.
Freeze activity and decide whether to fix forward or reconcile those writes before
restoring. Keep database and artifacts at the same recovery boundary.
