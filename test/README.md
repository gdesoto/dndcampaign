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

See `vitest.config.ts` for scheduling and worker settings. API tests use a shared
server; diagnostics are retained in `storage/api-test-server.log`. Investigate
failures rather than increasing timeouts or adding retries.

Keep this README concise and focused on lasting guidance; remove outdated information and avoid duplicating information.
