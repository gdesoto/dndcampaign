# Prisma to Drizzle migration plan

Status: implemented; local and production-backup rehearsals passed on `codex/drizzle-migration`; live rollout pending.
Started: 2026-10-03, against repository revision `d06b7ec`.

## Implementation record

The application, seed, fixtures, and database commands now use Drizzle ORM 0.45.3,
Drizzle Kit 0.31.11, and better-sqlite3 12.11.1. GPT-6.1 Sol agents ported the
domains in parallel. The original Prisma schema and 34 migrations remain frozen
as historical compatibility fixtures; no active Prisma dependency remains.

The migration bundle contains a physical-schema baseline and a reviewed timestamp
default migration. The latter rebuilds 50 tables to replace `CURRENT_TIMESTAMP`
with numeric epoch-millisecond defaults while retaining declared types, IDs,
constraints, indexes, and data. Preserving the old SQL defaults would continue
creating mixed text/numeric dates because SQL defaults take precedence over
Drizzle application defaults. Historical text dates are normalized in the same
atomic migration. Any unsupported history, schema drift, invalid date, or integrity
failure aborts the upgrade before the application starts.

The shared migration runner recognizes the supported Prisma history, records the
Drizzle baseline, applies pending SQL inside one immediate transaction, verifies
schema and foreign keys before commit, and leaves Prisma history intact. Fresh
databases use the same migrations. `db:check` verifies an existing current database
without changing it; `db:backup` creates and verifies a SQLite backup. Docker keeps
the existing environment and `/data` layout. The implemented release and recovery
procedure is maintained in [DeploymentRecovery.md](../docs/DeploymentRecovery.md).

Validation results:

- A consistent backup of the existing development database upgraded successfully:
  all 51 application tables and 11,048 rows matched deterministic content hashes
  after the documented timestamp normalization. The upgrade took about 0.9 seconds;
  a repeat run applied nothing. The original development database was unchanged
  during this isolated rehearsal.
- The user subsequently migrated the original local development database and
  confirmed login, browsing, and writes work. A subsequent `yarn db:check` reported
  `state: current`, `applied: 2`, and `pending: 0`. The user also confirmed production
  is already running the Prisma version. Its migration state was subsequently
  verified from the cold production backup described below.
- The previous installed Prisma client successfully read and wrote an upgraded
  reference database. This is client compatibility evidence; the exact production
  image still needs a staging rollback rehearsal before deployment.
- New migration tests cover adoption, fresh initialization, date/JSON/UUID semantics,
  backup restoration, idempotence, drift/history rejection, and transactional
  recovery after failed DDL/data migration. Native transaction contention and
  map reimport rollback/storage cleanup have targeted coverage.
- `yarn lint` and `yarn typecheck` passed after the final source fixes.
  `yarn test` passed all 319 tests in 80 files across the unit, API, and Nuxt
  projects. `yarn test:e2e` passed all four Chromium workflows, covering login,
  campaign/session/transcript navigation, activity, admin, and encounter screens.
  Production `yarn build` passed inside the final Linux Docker build. Logs remain
  locally under `storage/drizzle-lint-passing.log`, `drizzle-typecheck-final.log`,
  `drizzle-test-passing.log`, `drizzle-e2e.log`, and `drizzle-docker-final.log`.
  A separate Windows production build was canceled while final fixes were landing;
  Windows development was verified through typecheck and the full test suites.
- Linux runtime matrix passed on the first Docker image: fresh initialization;
  existing Prisma reference and development-backup adoption; idempotent restarts;
  and current-database startup with `RUN_MIGRATIONS=0`. All 51 tables and 11,048
  development rows matched normalized content hashes after container adoption;
  integrity and foreign-key checks passed. Legacy, baseline-only pending, and
  unknown databases with migrations disabled exited with code 1 before listening.
  Deliberately invalid packaged migration SQL also blocked startup. HTTP smoke
  passed registration/logout/login, authenticated account lookup, campaign/session
  writes, recording upload, and `206 bytes 0-8/21` artifact playback. Every mount
  was an isolated copy under `storage/drizzle-rehearsal/docker-*`; containers were
  removed. Ignored evidence scripts: `docker-smoke.mjs`, `docker-verify.mjs`, and
  `docker-prepare-failures.mjs` in that rehearsal directory.

- Final Linux image rebuilt after source fixes with
  `docker build -f docker/Dockerfile -t dndcampaign:drizzle-migration .`;
  build output is `storage/drizzle-docker-final.log`. Local immutable image ID:
  `sha256:593fa0eedea863342e1a525f786373f9b3b6b8aa17ce6448b37b2889f6124ecf`.
  `docker run -d -p 4291:3000 --mount type=bind,source=<rehearsal>/docker-fresh,target=/data -e RUN_MIGRATIONS=0 ...`
  passed current-database startup; `node storage/drizzle-rehearsal/docker-smoke.mjs`
  passed login, writes, upload, and byte-range playback on that image. The same
  smoke passed on port 4292 against the previously adopted development backup copy
  using `SMOKE_BASE_URL=http://localhost:4292`. `docker restart` followed by
  `docker exec <container> node scripts/database.mjs check` passed for both
  mounts (current, two migrations, zero pending); normal startup on the development
  copy applied zero migrations. All final containers were removed. These local
  checks made no production deployment or image publication.

### Production backup rehearsal — 2026-10-03

The user saved the running Prisma image and made a cold copy of the Unraid data
directory at `/mnt/user/backups/dndcampaign-prisma-20261003-221028`, then restarted
the existing application. The production container is named `dnd-campaign`; the
host directory remains `/mnt/user/appdata/dndcampaign` without a hyphen. Its
database is `/data/db/app.db`, storage is `/data/storage`, and migrations are enabled.
The canonical storage provider variable is `NUXT_STORAGE_PROVIDER=local`; the
reported `NUXT_STORAGE_PROVIDER_DEFAULT` setting is unused, with local storage
currently selected by the application's default.

The copied source is under ignored `storage/drizzle-rehearsal/production/`.
Its 186,904,576-byte database has all 34 supported completed Prisma migrations,
the expected legacy schema, a passing integrity check, and zero foreign-key
violations. All 83 present storage files (5,123,957,569 bytes) match their stored
SHA-256 checksums, including both map files. Three existing unreferenced VTT
artifact records point to missing files (851,385 bytes total); none are referenced
by recordings, recap recordings, transcription artifacts, or character portraits.
These records were preserved rather than cleaned up as part of this migration.

Rehearsal used a separate SQLite backup and physical storage copy, mounted into
the final image above with Docker `--network none` and a temporary session secret.
There was no live-production mount, published port, or provider connectivity.

- Startup adopted the Prisma baseline and applied both Drizzle migrations.
  Every application row matched deterministic hashes after documented date
  normalization: **51 tables, 11,574 rows**. Integrity and foreign-key checks passed.
- Migration took about **89 seconds** through Docker Desktop's Windows bind mount;
  subsequent migration checks at startup took about 15–16 seconds. These are local
  rehearsal measurements, not predicted Unraid downtime.
- Backup and restore of the migrated database passed the same content and
  readiness checks. Host-side SQLite inspection was performed with the container
  stopped, avoiding cross-platform file-lock and active-journal conflicts.
- HTTP checks covered both original campaigns, all 29 sessions and 20 documents,
  document edit/history/restore, and byte-range responses from all 76 currently
  linked local artifacts. Temporary owner authentication changes were confined
  to the working copy and original password hashes were restored.
- A fresh account, campaign, session, document, and recording upload were created
  in the working copy. Login, saved content, and media byte ranges survived restart.
  Repeat startup reported `action: current`, `applied: 0`.

Aggregate evidence and runnable local harnesses are under `storage/drizzle-rehearsal/`:
`production-inventory.json`, `production-migration-result.json`, `production-http-result.json`,
`production-container.log`, `production-rehearsal.mjs`, and
`production-http-smoke.mjs`. The copied source backup was kept unchanged. Final
checks confirmed all six original account password hashes and all 20 original
document version pointers were restored in the working database. The temporary
container was removed; the isolated working files remain available for inspection.
The old Prisma image archive remains on Unraid; that exact old image was not
loaded or tested locally. Restoring the pre-upgrade database and matching files
with the saved image remains the deployment rollback path.

No production database, deployment, or image publication has been changed by this
work. The sections below retain the original design and release gates; repository
findings refer to the starting revision where files have since moved.
The production-backup rehearsal has passed. Remaining release steps are
publication and a controlled live cutover with a **fresh** database and
artifact backup after stopping writers; production has continued running since
the rehearsal snapshot. The current workflow publishes both a revision tag and
`latest` on `master` pushes or manual dispatch. The user confirmed that Unraid
updates are manual: image publication alone does not replace the running container.
Use Unraid's container update/recreate operation for cutover; pulling an image and
issuing only `docker restart` leaves a container on its original image.
The release is prepared on `codex/drizzle-migration`; no merge or publication has
been performed.

## Recommendation and deployment outcome

Replace Prisma with Drizzle while retaining SQLite, `better-sqlite3`, the existing
table/column names, record IDs, and Docker `/data` mount. The preferred deployment
is a normal image replacement with a short maintenance window: the new image
recognizes the supported Prisma database, adopts a fixed Drizzle migration
baseline, applies any reviewed compatibility migration, and starts the app.
No export/import or new database server should be inherently necessary.

This path is now verified on the copied production snapshot described above. The
live Unraid deployment has not been upgraded. Here, seamless means preserving
configuration and data in the existing volume; it does not promise zero downtime.

If the existing file cannot be adopted reliably, use a planned maintenance window
to restore a verified backup into a separate staging location, migrate or convert
that copy, validate it, and replace the production database while the app is
stopped. Keep the original database and matching artifacts for rollback.

Scope stays limited to the ORM and its operational tooling. Keep API paths,
payloads, authorization, frontend behavior, SQLite, and artifact storage contracts.
Do not combine this with table renaming, a PostgreSQL move, UI work, general test
cleanup, or speculative repository abstractions. The open tickets in
[CodeSimplificationPlan.md](CodeSimplificationPlan.md) are not prerequisites.

## Repository findings that drive the work

| Area | Current evidence | Migration consequence |
| --- | --- | --- |
| Schema | [schema.prisma](../prisma/schema.prisma): 51 models, 47 enums, 48 UUID defaults, 34 `@updatedAt` fields; 34 migration directories. | This is a backend-wide rewrite, including runtime defaults and generated types, not just swapping the client import. |
| Coupling | Prisma references occur in 106 server TypeScript files and 25 test files in this source snapshot. No direct Prisma coupling was found in `app/` or `shared/`. | Port handlers, services, auth helpers, middleware, and test fixtures together by domain; preserve existing shared API schemas. |
| Driver and locking | [prisma.ts](../server/db/prisma.ts), [sqlite-adapter.ts](../server/db/sqlite-adapter.ts). | Retain the driver family and the current `BEGIN IMMEDIATE` behavior. |
| Paths | Runtime, [prisma.config.ts](../prisma.config.ts), seed, and test client resolve relative `file:` URLs from `prisma/`. | Keep `file:../storage/db/dev.db` pointing to the same file after removing Prisma. |
| Dates | Runtime writes `unixepoch-ms`; SQL declares `DATETIME` and often defaults to `CURRENT_TIMESTAMP`. The [owner-membership backfill](../prisma/migrations/20260219123000_backfill_owner_campaign_memberships/migration.sql) writes text timestamps. | Profile actual stored types; date decoding alone cannot correct mixed-type SQL comparisons or sorting. |
| Types and constraints | Migrations also use `BOOLEAN` and `JSONB` declarations, named unique indexes, and composite foreign keys. | Preserve physical schema and value semantics; do not accept a generated table rebuild merely to use Drizzle's usual type declarations. |
| Transactions with storage | [map.service.ts](../server/services/map.service.ts) reimport awaits `putObject` inside a Prisma transaction. | Restructure this workflow for synchronous database transactions without losing failure cleanup. |
| Docker | [Dockerfile](../docker/Dockerfile), [start.sh](../docker/start.sh), [Unraid compose](../docker/docker-compose.unraid.yml): Node 24, `file:/data/db/app.db`, `/data/storage`, `RUN_MIGRATIONS=1`. | Keep these operational inputs; replace the startup migrator and packaged dependencies. |
| Publication | [deploy-docker.yml](../.github/workflows/deploy-docker.yml) publishes on `master`, tags only `latest`, and has no separate test gates. | Keep intermediate work off the production branch; introduce an immutable release reference and release validation. |
| Recovery | [DeploymentRecovery.md](../docs/DeploymentRecovery.md) describes recovery, but no dedicated backup/restore command is implemented. | A verified backup, restore rehearsal, and concrete release runbook are required deliverables. |

Counts are an inventory aid, not a fixed acceptance target; recheck them when
implementation begins. Prisma dependency ranges start at `^7.4.1`, while the
inspected lockfile/installed adapter resolve to 7.10.0; use the lockfile and image
digest when establishing the old-runtime baseline.

## Target design and initial decisions

- Use `drizzle-orm/better-sqlite3`, with `better-sqlite3` declared directly.
  Drizzle supports this driver, so changing database engines or adopting a remote
  service is unnecessary. [Drizzle SQLite connections](https://orm.drizzle.team/docs/sqlite/get-started-sqlite).
- Pin compatible ORM, Kit, and driver versions for the migration. Registry
  inspection found stable tags `drizzle-orm` 0.45.3 and `drizzle-kit` 0.31.11;
  both also have a separate 1.0 RC line. Treat these as starting candidates and
  verify them again at implementation time. Do not install an RC implicitly
  because an example uses `@rc`. [ORM package metadata](https://registry.npmjs.org/drizzle-orm/latest),
  [Kit package metadata](https://registry.npmjs.org/drizzle-kit/latest).
- Put the connection and shared path handling in `server/db/`; keep table
  definitions there, grouped by domain only where this improves navigation.
  Use `drizzle.config.ts` and a versioned `drizzle/` migration directory. Keep
  CLI-accessible database modules independent of Nuxt-only aliases/runtime.
- Keep business queries in existing services and authorization in handlers.
  Replace Prisma types with inferred Drizzle row/insert types or existing shared
  domain types. Avoid a Prisma-shaped facade or a new generic repository layer.
- Use one reusable path resolver and connection configuration for runtime,
  migration, seed, and test processes. Preserve existing absolute Windows/Linux
  paths and legacy relative `file:` semantics, even if the `prisma/` directory
  later disappears. Upgrade/restore commands must require the source file to
  exist, so a mistyped path cannot silently create an empty replacement.
- Explicitly enable foreign-key enforcement on every connection; choose a
  bounded busy timeout and verify contention behavior. Inspect and retain the
  current journal mode for this migration; changing to WAL is a separate decision.
  Keep development connection reuse and close handles in scripts/tests/shutdown.
- Generate reviewed SQL in development and apply committed migrations in Docker.
  Do not run schema `push`, introspection, or migration generation at production
  startup. Installation and production builds must work without a live database.

## Compatibility requirements

| Concern | Required implementation and verification |
| --- | --- |
| Physical schema | Match table and column names, declared types/affinities, nullability, SQL defaults, primary keys, unique/index definitions, and `ON DELETE`/`ON UPDATE` actions. Include `SessionCalendarRange`'s composite session/campaign relationship. Compare actual SQLite metadata, not only ORM source files. |
| UUIDs and defaults | Retain existing UUID strings. Use `crypto.randomUUID()` for new UUID defaults and reproduce required insert defaults. Distinguish application defaults from database defaults; raw SQL does not run ORM hooks. |
| Timestamps | Return `Date` values where services expect them and preserve ISO API output, millisecond precision, nulls, expiration, and ordering. Implement `createdAt` and `updatedAt` behavior, including upserts, conflict updates, bulk writes, and document version timestamps. |
| Historical dates | Inspect `typeof()` distributions for every date column on a copy. Include rows created by old SQL migrations. If mixed values exist, prepare a reviewed conversion of valid text dates to epoch milliseconds, interpreting SQLite `CURRENT_TIMESTAMP` as UTC. Preserve existing numeric milliseconds/nulls; reject unparseable values. Verify range/sort results and old-Prisma readability before allowing this as an automatic in-place migration. |
| Declared type mapping | `integer({ mode: 'timestamp_ms' })`, boolean mode, and JSON text mode are useful mappings, but changing declarations from `DATETIME`/`BOOLEAN`/`JSONB` may create unwanted DDL. Prove small shared custom types and Kit snapshots can retain declarations; otherwise explicitly plan and rehearse the required conversion. Do not leave schema generation permanently reporting false drift. |
| JSON and enums | Preserve JSON serialization, SQL NULL versus JSON `null`, and existing enum strings. In particular, replace the explicit `Prisma.JsonNull` used by dungeon import intentionally. Keep intentionally JSON-encoded string fields such as `Artifact.meta` distinct from true JSON fields. Reuse Zod validation; type-only enum declarations do not validate incoming data. |
| Query results | Preserve `select`/`include` projections, optional relation nulls, relation ordering, counts, pagination, search behavior, and public field whitelists. Avoid duplicate parent rows/counts from joins and unnecessary per-row queries. Preserve omitted/undefined update fields versus explicit null. |
| Nested writes | Translate nested creates, connects, deletes, upserts, increments, and relation replacement into explicit statements inside the same transaction. Keep unique conflict targets, ordering, and affected-row/not-found behavior. |
| Authorization | Rewrite `buildCampaignWhereForPermission` and child-resource lookups into SQL predicates/joins or `EXISTS` while retaining handler-owned checks. Test owner/member/admin rules, DM access, cross-campaign IDs, bearer-key scope, public access, and existing 403/404 behavior. |
| Error handling | Replace Prisma `P2002` handling in public slug generation and transcription artifact deduplication with precise SQLite unique-constraint handling, including wrapped causes. Preserve retry/cleanup behavior and the existing API error envelope; do not swallow all constraint failures. |

Drizzle's [SQLite column documentation](https://orm.drizzle.team/docs/sqlite/column-types)
describes timestamp/boolean/JSON modes and type-only enums; its
[custom types documentation](https://orm.drizzle.team/docs/custom-types) describes
driver value mapping. The exact mapping and generated SQL still require a spike
against this schema and the pinned versions.

A decoder that accepts both text and numbers only fixes values after selection.
It does not fix SQL date comparisons. Cover membership ordering, invite expiry,
admin date filters, and journal session cutoffs. If retaining the existing
`CURRENT_TIMESTAMP` SQL defaults, all ORM insert paths must explicitly supply
milliseconds; seed/import/raw-SQL paths need the same rule. Any necessary default
changes belong in reviewed migrations rather than being hidden in the ORM swap.

### Transaction conversion

Use synchronous callbacks with explicit execution of each query and
`{ behavior: 'immediate' }` for transactions that preserve the current writer-lock
contract. The pinned Drizzle implementation supports the behavior option and
otherwise defaults to deferred transactions.
[Drizzle 0.45.3 SQLite session implementation](https://github.com/drizzle-team/drizzle-orm/blob/0.45.3/drizzle-orm/src/better-sqlite3/session.ts).

Do not carry `async` callbacks or awaited service methods into a synchronous
transaction. Keep service APIs async where their callers need them, but database
work within a transaction must complete before its callback returns.
The driver's [transaction documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function)
explains its synchronous transaction lifetime.

For map reimport and similar workflows: prepare/upload new files outside the
transaction using distinct storage keys, revalidate the necessary database state
inside the transaction, atomically switch database references, then remove old
files after commit. On failure before commit, remove newly prepared files and
retain the old references/files. If old-file cleanup fails after commit, retain
the newly referenced files and report/defer that cleanup; do not compensate by
deleting committed files. Do not overwrite old objects before a successful commit.
Avoid holding a database lock during storage, provider requests, or hashing.

Port the existing [SQLite contention test](../test/unit/sqlite-adapter.test.ts)
to the new connection and preserve its assertions about acquiring a write lock
before reads, rollback, and recovery after failed acquisition.

## Migration history and existing-database adoption

Prisma's `_prisma_migrations` table is not a Drizzle migration journal. A full
initial Drizzle migration must create a fresh database, but must never be executed
against already-existing application tables.

### Establish one fixed baseline

1. Freeze the supported last-Prisma release, its migration names/checksums, and
   expected final schema. Finish outstanding Prisma migrations before adoption;
   include their data backfills, not just the resulting table definitions.
2. Build a disposable database with all 34 current Prisma migrations. Compare
   it with a copied deployment database and resolve drift or unfinished migrations.
   Only supported, completely migrated Prisma databases qualify for automatic
   adoption. Older databases first upgrade using the supported Prisma image.
3. Introspect the disposable database as a starting point. Review every mapping
   against Prisma semantics and actual SQLite DDL. Exclude `_prisma_migrations`
   and Drizzle's journal from application schema management; leave the existing
   Prisma journal intact for rollback and audit.
4. Commit a fixed initial schema migration and its matching snapshot/metadata.
   Apply that exact artifact to an empty test database and compare its application
   schema with the fully migrated Prisma reference. Generating again with unchanged
   schema should produce no application DDL changes.
5. Implement one small adoption path in the migration entrypoint. Under a write
   lock, validate the expected Prisma history and physical schema, then record
   only that fixed baseline as applied in Drizzle's journal. Commit adoption
   atomically and make retry/restart safe. Apply later compatibility migrations
   through the normal migrator, with failure recovery tested separately.

Do not assume `drizzle-kit pull --init` exists in every release. Current
[pull documentation](https://orm.drizzle.team/docs/drizzle-kit-pull) describes it,
but the [1.0 beta release notes](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
introduce that feature and a new migration layout. Verify the chosen version's
actual behavior before using it. It writes migration metadata to the database,
so experiment on disposable copies only.

For a pinned stable version without a suitable adoption API, derive the baseline
journal schema and record from applying the committed baseline with the real
migrator to a disposable database. Use those exact artifact identifiers,
hashes/timestamps, and journal format in the narrowly scoped adoption helper;
test against that version and recheck on upgrades. Do not invent journal values,
mark future migrations applied, or regenerate a different baseline on each host.
This explicit helper is preferable to relying on an unverified CLI flag.

### Startup decision table

| Database state | Required behavior |
| --- | --- |
| New/empty database, migrations enabled | Apply the committed initial migration and later migrations. Do not run demo seeds in production. |
| Supported Prisma database, no Drizzle history | Validate history/schema, adopt the fixed baseline, then apply reviewed pending migrations. Existing tables/data survive. |
| Recognized Drizzle database | Validate the journal against packaged artifacts and apply only pending migrations. A second startup makes no changes. |
| Older Prisma database, failed history, unknown schema, or incompatible Drizzle history | Exit nonzero before HTTP startup with a specific reason and recovery direction. Do not guess, stamp it as current, or reset it. |
| `RUN_MIGRATIONS=0` | Perform a read-only compatibility check and start only if the database is already ready; perform no baseline registration or migration. |

One process owns migration/adoption; never run old and new application writers
against the volume concurrently. Check state again after acquiring the lock.
Keep the frozen Prisma schema/migrations available through the rollback window
(without active Prisma runtime dependencies); preserve the release reference in
Git when removing that historical folder later.

## Implementation sequence and completion gates

Implementation is on a `codex/` integration branch; intermediate
commits may temporarily contain both ORMs for development, but do not deploy a
partially migrated application or split one transaction across the two clients.

| Phase | Work | Gate before proceeding |
| --- | --- | --- |
| 1. Baseline and compatibility spike | Capture current tests and immutable Prisma image; inventory remaining imports; pin candidate versions; test declared types, mixed dates, JSON nulls, UUID/update defaults, native bindings, locking, and baseline registration. | Demonstrate read/write parity on a disposable Prisma database and identify every required schema/data conversion. Choose automatic adoption or planned restore based on evidence. |
| 2. Database foundation | Add schema, relations where useful, shared path/connection setup, SQL migration artifacts, adoption/status entrypoint, and a Drizzle test client. | Fresh creation, adoption, restart, next migration, drift rejection, and failed-start recovery all pass. No unexplained generated schema diff. |
| 3. Access and simple domains | Port auth/account/admin/API keys, campaign membership/invites/public access, and permission predicates first; then sessions, characters, glossary, quests, milestones, requests, and calendars. | Relevant existing API behavior and permission tests pass for each domain; API field projections stay stable. |
| 4. Transaction-heavy domains | Port documents/versioning, artifacts/recordings/recaps, transcription/summary/suggestions, journal/tags/transfers, encounters/templates, maps and dungeons. Keep each workflow's database changes together. | Meaningful rollback, duplicate callback, concurrent update, version ordering, cascading deletion, and storage-failure workflows pass. No async work escapes a synchronous transaction. |
| 5. Tooling and Docker cutover | Port seed and all fixture setup/cleanup; replace Prisma build/install/migration scripts; package the migrator and migration artifacts; remove Prisma runtime imports/dependencies/generated client/adapter. Update docs and release workflow. | Clean install, lint, typecheck, complete test suite, production build, E2E, and runtime image checks pass using only Drizzle. |
| 6. Rehearsal and release | Exercise the chosen deployment and rollback on a representative backup plus artifacts; record timings, data comparison, image digests, commands, and outcomes. | Existing-volume upgrade or planned restore succeeds, repeat startup is safe, and recovery is demonstrated before production cutover. |

Do not postpone all test conversion until phase 5: update fixtures and mocks
alongside the domain they support. Phase 5 removes the remaining transitional
code. Existing relevant tests include `test/api/*.test.ts`, the SQLite contention
test, and Nuxt artifact/recording service tests. Retain a few comprehensive
migration/compatibility workflows instead of adding a separate tiny test for
every table or query.

### Tooling changes to include

- Replace Prisma commands in `package.json`, `test/scripts/test-db-utils.mjs`,
  `test/scripts/prisma-test-client.ts`, and API/E2E setup; port `prisma/seed.ts`.
  Close all clients before deleting test databases and account for SQLite sidecars.
- Retain `db:migrate:deploy` as the operator-facing entrypoint. Document generation
  versus application explicitly: Drizzle generates SQL, not a client. Keep useful
  existing script names only with clear new meanings, and provide a read-only
  migration status/preflight command. These are implementation deliverables, not
  commands currently available in this checkout.
- Package a Node-executable migration entrypoint and committed SQL/metadata in
  the runtime image. Reuse it for tests and manual operations. Compile/bundle it
  during the build if authored in TypeScript; do not assume `tsx` or Kit remains
  installed after dependency pruning. Avoid `npx` downloads at container startup.
- Update Docker's install/build copy ordering after removing Prisma generation.
  Retain `exec node .output/server/index.mjs`, fail-before-start behavior,
  environment aliases, storage directories, and the existing mount paths.
  Build native `better-sqlite3` for the image's Node 24/Linux target; verify the
  binding in the final image. Add toolchain packages only if the selected binary
  actually requires compilation. Do not mix in unrelated image optimization.
- Keep the compose environment and `/data` contract. Ensure the migration bundle
  is outside `dev_plan/`, which `.dockerignore` excludes. A build needs no real
  database URL; any placeholder must never cause migration or connection at build.
- Add lint/typecheck/tests and migration rehearsal as release gates; publish an
  immutable commit/version tag and record its digest in addition to `latest`.
  The previously published Prisma image must also be retained by digest.
- Update `README.md`, `AGENTS.md`, `docs/README.md`, and
  `docs/DeploymentRecovery.md` when behavior is implemented. Update affected
  feature documentation only for actual changes. No API contract change is
  intended; any necessary route/payload change requires its own tests and the
  matching `public/openapi.json` update.

## Docker deployment runbook to implement and rehearse

### Preferred: upgrade the existing volume

1. Record the old and new immutable image digests, environment, mount path,
   migration status, and the supported last-Prisma schema. If necessary, upgrade
   an older installation with the Prisma release first and verify its backfills.
   Preserve a pre-upgrade backup as well if that preparation changes the database.
2. Rehearse the new image on a restored copy of the actual deployment data and
   artifacts. Disable external callbacks/provider calls in that rehearsal and
   route it separately. Check disk space for the database, backups, conversion
   copies, and artifacts; measure the expected maintenance window.
3. Put the production deployment into maintenance, stop new requests/uploads and
   automated updates, and stop/drain app writers and in-flight jobs. Coordinate
   callback retry/replay rather than assuming requests during downtime will persist.
4. Create and verify a consistent database and artifact backup at this boundary.
   Save configuration/secrets securely with the recovery instructions, including
   session-signing configuration needed by the old/new image. Never commit them.
5. Start only the new image on the existing `/data` mount with migrations enabled.
   It validates/adopts/migrates before listening. On any mismatch or migration
   failure, keep traffic closed and use the recorded recovery procedure.
6. While still in maintenance, verify data counts and representative records,
   login and `/api/auth/me`, owner/member/public/API-key access, document edit and
   restore, artifact range playback, and the workflows listed below. Verify
   callback processing safely before resuming provider traffic.
7. Restart once to prove idempotent startup, then reopen traffic and resume jobs.
   Retain the backup and old image through the observation/rollback window.
   Record migration timing and any anomalies.

### Fallback: restore and migrate a separate database

Use this when adoption cannot pass its compatibility gates or a deliberate
schema/data conversion is necessary. A backup restore alone does not fix a
format mismatch; the conversion must be a repeatable, tested operation.

1. Use the same maintenance and backup boundary as above. Preserve the untouched
   original and work only on a separate restored copy. For an ordinary adoption
   failure, fix and rerun the tested adoption on that copy first.
2. If a new schema is required, initialize a new Drizzle database and copy data
   with an explicit, versioned conversion: preserve all primary/foreign keys,
   secrets/hashes, document versions, JSON/nulls, timestamps, and storage keys.
   Handle foreign-key ordering/cycles deliberately; perform integrity and
   foreign-key checks before accepting the result. Do not use the demo seed or
   Prisma/Drizzle journals as application data to import blindly.
3. Compare every application table's count and deterministic row content with
   the source, allowing only documented transformations. Check required data
   backfill invariants, storage references, and the full smoke workflow on the
   restored artifacts. Rehearse the same operation on the final frozen backup;
   an earlier staging copy would lose intervening production writes.
4. With all database connections closed, install the validated file at
   `/data/db/app.db` and restore the matching storage snapshot if needed.
   Preserve correct ownership/permissions. Handle old journal/WAL/SHM files as
   part of the stopped restore so stale sidecars cannot attach to the new file.
5. Start the pinned new image, verify again, then reopen traffic. Retain the
   original file/snapshot and old image until recovery is no longer needed.

For SQLite backup creation, use the SQLite backup API (available through
`better-sqlite3`) or a verified cold snapshot with all writers stopped. Never
copy just a live main database file and assume it contains WAL data. Artifacts
need a matching consistency boundary because they are stored separately.
[SQLite backup documentation](https://sqlite.org/backup.html).

### Rollback

- Before new user traffic, prefer the old image against the same database only
  if rehearsal proved that the baseline metadata and any data/schema changes are
  readable by that exact Prisma release. Its original migration journal remains
  intact. Test old-image reads and writes after representative Drizzle writes.
- If compatibility is unproven or a conversion is incompatible, stop the new
  container and restore the pre-cutover database and matching artifacts/config,
  then start the old immutable image. Never run old Prisma migrations against a
  converted database on the assumption they will undo Drizzle changes.
- After traffic reopens, restoring the pre-cutover backup discards subsequent
  writes. Freeze activity, preserve the failed/new state, and decide whether to
  fix forward or reconcile changes before restoring. Do not describe backup
  rollback after reopening as lossless.

## Required validation and release acceptance

Run `yarn lint` and `yarn typecheck` after code changes, domain tests during each
port, then `yarn test`, `yarn build`, and `yarn test:e2e` for the integrated release.
Use existing worker limits; diagnose SQLite contention instead of masking it
with retries/timeouts. Validate Windows development and the final Linux image.

| Validation | Acceptance evidence |
| --- | --- |
| Schema and data | Fresh Drizzle schema matches the supported Prisma schema; copied old data reads identically; all table counts/IDs/relationships and deterministic content checks pass, apart from explicitly documented conversions. `PRAGMA integrity_check` succeeds and `foreign_key_check` returns no violations. |
| Migrations | Fresh initialization, old-volume adoption, repeat startup, next normal Drizzle migration, migrations-disabled startup, unsupported/drifted history, and interrupted/failed migration recovery are exercised. No business data is erased, and a mismatch never starts a usable HTTP app. |
| Dates and defaults | Historical text/numeric dates, UTC handling, created/updated timestamps, expiry, filtering/sorting, UUID creation, enum and JSON/null round trips, and raw-SQL/seed paths behave as specified. |
| Authorization and response shape | Existing campaign, journal, public exposure, admin, account, API-key and cross-campaign denial tests pass without leaking extra joined fields. |
| Atomic workflows | Document version allocation/restore, journal transfer, encounter turn/reorder, request/vote uniqueness, map reimport failure, duplicate transcription callbacks/artifact cleanup, and summary/suggestion application preserve their invariants. |
| Storage and runtime | Existing recordings and recap media play with range requests; map/dungeon assets load; upload and provider callback smoke tests pass; `/data` contents survive restart and image replacement. |
| Performance | Compare representative campaign lists, large map import, long transcript/document work, and callback processing with the old release. Check query counts, lock contention, and event-loop delay; no speed or image-size improvement is assumed. |
| Recovery | Backup restoration and old-image rollback succeed on staging, with measured downtime and the post-cutover write-loss boundary documented. |
| Removal | No active Prisma imports, generated client, adapter, commands, or runtime dependencies remain. Frozen historical migration files and explanatory documentation are the only intentional references. |

The release is ready when the complete workflow runs on Drizzle and one of the
two deployment paths has been demonstrated with representative existing data.
Resolve the baseline/version support, historical timestamp handling, native
binding packaging, and real deployment schema in phase 1; these are feasibility
checks, not reasons to promise a restore will be necessary in advance.
