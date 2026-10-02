# Tests

Protect important workflows, business rules, API contracts, and meaningful failures
with a few comprehensive behavior tests. Extend existing scenarios instead of
adding tests for implementation details or duplicate coverage.

- **Unit:** domain logic and SQLite transaction behavior.
- **API:** real HTTP and SQLite workflows, permissions, persistence, and errors.
- **Nuxt:** component interactions and loading, failure, and recovery behavior.
- **E2E:** assembled browser workflows using Playwright.

Run `yarn test`, `yarn test:coverage`, `yarn lint`, and `yarn typecheck` for validation;
run `yarn test:e2e` for browser workflows. Focused runs use `yarn test:unit`,
`yarn test:nuxt`, or `yarn test:api`.

All three projects share `vitest.config.ts`, one summary, and coverage in `coverage/`.
Isolation is disabled globally: tests must clean up any state they change.
The Nuxt setup restores suite-level stubs and unmounts test components and the
Nuxt app between files; tests should not erase the shared document body.
When API tests are selected, their global server setup completes before any workers
start. Tests then run in unit, Nuxt, API order with separate worker limits.
API readiness includes the rendered login page so retired endpoints can reach
Nuxt's page fallback without compiling it inside a workflow test.

`yarn test:watch` watches all projects; add `--project api` to watch only API tests.
`yarn test:doctor` measures all projects; use `--project` to focus its comparisons.

API tests use a shared server; diagnostics are retained in
`storage/api-test-server.log`. Investigate
failures rather than increasing timeouts or adding retries.

Keep this README concise and focused on lasting guidance; remove outdated information and avoid duplicating information.
