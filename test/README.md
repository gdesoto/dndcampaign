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
On resource-constrained machines, use `yarn test --maxWorkers=2`. The managed
server allows three minutes for startup. The retired-profile route contract allows
one minute because its first request compiles Nuxt's page fallback; other test
timeouts are unchanged.
