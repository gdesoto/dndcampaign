# What this suite protects

Keep a test when it protects a workflow, business or design rule, API contract,
meaningful failure, or a plausible regression. Prefer extending a relevant
scenario over adding another fixture and test for each minor variation.

- **API:** real HTTP and SQLite workflows own permissions, public/private data
  boundaries, persistence, state transitions, and response contracts.
- **Nuxt:** interactions own accessible controls, read-only states, draft
  retention, concurrent actions, stale responses, and failure/retry behavior.
- **Unit:** pure domain logic owns representative parsing and calculation cases
  that are hard to diagnose through a full workflow. Avoid rechecking those input
  matrices through every adapter and endpoint.
- **E2E:** the login/session/editor, encounter, and admin workflows verify the
  assembled application, including desktop/mobile and theme behavior where relevant.

## Reduction decisions

- Removed starter examples, enum/default/shape schema smoke tests, simple
  slot/render checks, and duplicate calendar and encounter component checks.
- Consolidated campaign switching, calendar dates, imported scores, HP display,
  journal extraction, and dice behavior around representative scenarios.
- The recap API test now owns the upload, replace, publish, stream, invalid-upload,
  access-denial, and delete workflow. Range syntax variations live in the media
  unit tests; the API checks successful and rejected ranges on both stream routes,
  including their different error bodies.
- MCP adapter tests use public protocol calls instead of private SDK registries.
  Real API tests retain discovery, authentication, campaign isolation, encounter
  phase transitions, and writes; units retain local dice, query encoding, error
  propagation, and public OpenAPI credential handling.
- Moved invalid encounter damage and condition checks into the encounter API
  workflow. Retained custom calendar date bounds and discoverable visibility rules.
- Removed machine-dependent dungeon timing assertions; deterministic generation,
  map references, regeneration, locks, import/export, and permissions remain.
- Preserved regression suites for session ownership, stale requests, drafts,
  deletion recovery, media selection, storage failures, map imports, Markdown
  sanitization, and API key scope/expiration. All three browser workflows remain.

## Organize by behavior

Name suites for the feature or contract they protect, rather than the milestone
that introduced them. Put regression assertions into that feature's workflow.

- `api.session-documents` combines document creation/import/versioning, summary
  application, local transcription and subtitles with shared users and cleanup.
- `api.campaign-permissions`, `api.campaign-membership`,
  `api.campaign-public-access`, and `api.admin` own their authorization and audit
  checks. Invite hashing/expiry live with invitations, and throttling lives in
  `api.auth-campaign`; there is no separate release-hardening suite.
- `api.account` and `api.calendar` replace numbered milestone names.
- Character unlinking belongs in `campaign-characters-page`, map permissions in
  `campaign-maps-page`, retained data in `retained-resource`, and confirmation
  recovery in `shared-primitives`.

Run `yarn test` for the unit, API, and Nuxt projects, and `yarn test:e2e` for browser
workflows. Test changes also require `yarn lint` and `yarn typecheck`.
Worker limits are project-specific: unit tests use Vitest's normal parallelism,
Nuxt component tests use six workers, and API tests use three workers to limit
contention on their shared SQLite database. Tests execute in that order; Vitest
requires different scheduling groups for these different worker budgets. Group
ordering does not defer API global setup: database migration and server readiness
still happen before tests are scheduled. Keep performance comparisons free of
simultaneous lint/typecheck runs.

After upgrading to Test Utils 4.3.2, the separate budgets passed all 289 tests in
111.13 seconds of Vitest time, compared with 131.38 seconds in the saved upgrade
run with a global three-worker cap. These are single local runs, not a guarantee
of performance on other machines. The Nuxt-only 30-second hook timeout remains
because Test Utils 4 initializes the app in `beforeAll`.

Scheduling checkpoint (2026-09-23): the earlier two-API-worker configuration passed all 289 tests
in 137 seconds. A global two-worker limit plus serial API files took 216 seconds;
normal unit/Nuxt parallelism plus serial API files took 148 seconds. Restoring
unrestricted parallelism took 117 seconds but failed four tests on timeouts and
one on a Prisma operation timeout. The four-API-worker experiment was stopped;
it is not a validated configuration. Timings are single local runs, not benchmarks.
The user subsequently measured 115.89 seconds with three API workers and all tests
passing, and reported one failure with four. Three is the current setting.

## Nuxt 4 testing research and startup profile

Keep real HTTP API workflows in their Node project. The `api` name is our own
category for server integration tests; Nuxt's documented E2E helpers also run in
Node and do not require a browser. The Nuxt runtime environment initializes the
Vue app in Happy DOM and supports mocked endpoints; it does not automatically
load the real `server/api` routes. Moving our API workflows there would either
retain the real server cost while adding DOM setup, or replace real HTTP coverage
with mocks. The shared API server already starts once per run, not once per file.

A temporary profile of the three-worker configuration measured these milestones
relative to Vitest's test-run-start event (2026-09-23):

| Milestone | Elapsed |
| --- | ---: |
| Database migration complete | 6.0s |
| API server ready | 38.4s |
| First Nuxt test file queued | 42.5s |
| First test starts | 64.5s |

Before that event, evaluating the configuration, including `defineVitestProject`,
took another 5.5 seconds (excluding initial static dependency imports). The API
global setup blocks initial test scheduling even though API files run in the later
group. After queueing, Nuxt worker initialization, module transforms/imports, and
collection account for about 22 seconds before the first test. These are local
observations, not fixed performance expectations.
The profiled run passed all 289 tests in 106.74 seconds of Vitest time (114.84
seconds reported by Yarn). Only temporary instrumentation was added for this run;
the configuration and test setup were otherwise preserved. The timeline and full
output remain in `storage/test-startup-timeline.jsonl` and
`storage/test-startup-profile.log`.

The startup profile above predates the upgrade: it used Nuxt 4.5.2, Test Utils
3.23.0, and Vitest 4.1.11. Test Utils is now 4.3.2, which supports Vitest 4;
initialization and router mocks have been updated and validated. The scheduling
comparisons above do not isolate the performance effect of the package upgrade.
Keep the API project separate and shared-server lifecycle intact. Consider lazy
project configuration for focused unit/API runs so they do not eagerly initialize
the component-test configuration. Simply replacing the shared server with per-file
`setup()` calls could add builds rather than remove them.

Sources checked on 2026-09-23:

- [Nuxt 4 testing guide](https://nuxt.com/docs/4.x/getting-started/testing)
- [Test Utils 4 migration notes](https://github.com/nuxt/test-utils/releases/tag/v4.0.0)
- [Current Test Utils releases](https://github.com/nuxt/test-utils/releases)
- [Test Utils 3.23.0 peer dependencies](https://github.com/nuxt/test-utils/blob/v3.23.0/package.json)

The linked Nuxt 3 article demonstrates mocked handler unit tests, including mocked
H3 body/parameter handling. That is a different coverage boundary from these real
authentication, persistence, multipart, streaming, and response-envelope workflows.

The default test timeout remains five seconds. Individual multi-request workflows
allow 15 seconds for throttling, journal permissions, recap lifecycle, and dungeon
generation/editing; dungeon rendering/export/import allows 30 seconds. These are
completion budgets, not sleeps or performance assertions. Use a local option such
as `it('workflow', { timeout: 15_000 }, async () => { ... })` when justified by real
work. Do not increase timeouts to hide HTTP errors or database contention.

The managed server allows three minutes for startup and checks API readiness before
tests start. It rejects an occupied port and detects premature server exit. Startup
failures also clean up the temporary database. Server output is retained in
`storage/api-test-server.log` (overwritten each API run) for diagnosing HTTP 500s.
The retired-profile route contract allows one minute because its first request
compiles Nuxt's page fallback.
