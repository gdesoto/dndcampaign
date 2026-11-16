# Tests

Protect important workflows, business rules, API contracts, and meaningful failures
with a few comprehensive behavior tests. Extend existing scenarios instead of
adding tests for implementation details or duplicate coverage.

- **Unit:** domain logic and SQLite transaction behavior.
- **API:** real HTTP and SQLite workflows, permissions, persistence, and errors.
- **Nuxt:** component interactions and loading, failure, and recovery behavior.
- **E2E:** assembled browser workflows using Playwright.

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, and `pnpm typecheck` for validation;
run `pnpm test:e2e` for browser workflows. Focused runs use `pnpm test:unit`,
`pnpm test:nuxt`, or `pnpm test:api`.

All three projects share `vitest.config.ts`, one summary, and coverage in `coverage/`.
Unit/API files reuse worker state; Nuxt files are isolated so auto-import mocks
cannot leak between files. Tests must still clean up state they change.
The Nuxt setup unmounts test components after each test and the Nuxt app after
each file; tests should not erase the environment's document body.
When API tests are selected, their global server setup completes before any workers
start. Tests then run in unit, Nuxt, API order with separate worker limits.
API readiness includes the rendered login page so retired endpoints can reach
Nuxt's page fallback without compiling it inside a workflow test.
API and browser servers use a temporary artifact root under `tmp/`, separate
from local application storage. API fixtures use `getApiTestStorageRoot()` for
direct file access; server teardown removes only that run's artifacts and database.

`pnpm test:watch` watches all projects; add `--project api` to watch only API tests.
`pnpm test:doctor` measures all projects; use `--project` to focus its comparisons.

API tests use a shared server; diagnostics are retained in
`storage/api-test-server.log`. Investigate
failures rather than increasing timeouts or adding retries.

Keep this README concise and focused on lasting guidance; remove outdated information and avoid duplicating information.
