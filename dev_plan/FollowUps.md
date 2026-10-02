# Development follow-ups

Reviewed against source and tests on 2026-10-02. This retains remaining work,
optional ideas, and unverified acceptance checks from the archived plans.
Completed milestones and old failures are historical records in
[PlanningHistory.md](PlanningHistory.md). Optional ideas require a product
decision before implementation; verification gaps are not confirmed defects.
Use [CodeSimplificationPlan.md](CodeSimplificationPlan.md) for the current
refactor queue and [DeploymentRecovery.md](../docs/DeploymentRecovery.md) for rollout
verification and recovery.

## Summary and suggestion review

- Show proposed changes beside the existing target's values before applying an
  update suggestion. The current review offers editable proposed values, Apply,
  and Discard, but no comparison view.
- Add batch Apply all and Discard all actions; current actions operate on one
  suggestion at a time.
- Complete automated coverage from generation through authenticated callback,
  duplicate callback handling, summary application, and suggestion application
  or discard, including permissions and failures. Existing coverage of job
  history/kinds, response validation, routing, refresh, and serialized actions
  should be reused.

Current behavior is documented in [SessionJobs.md](../docs/SessionJobs.md).
Read [SessionWorkspaceOwnership.md](../docs/SessionWorkspaceOwnership.md)
before changing session orchestration.

Relevant source: `server/services/summary.service.ts`,
`server/services/summary-suggestion.service.ts`, and
`app/components/session/SummarySuggestionList.vue`. Existing tests include
`test/api/api.session-jobs.test.ts`, `test/api/api.dev-n8n-test.test.ts`,
`test/nuxt/session-jobs.test.ts`, `test/nuxt/session-suggestion-actions.test.ts`,
and `test/nuxt/session-workspace-routes.test.ts`.

## UI verification

| Check | Remaining verification |
| --- | --- |
| Appearance persistence | Verify light/dark/system preference after reload and navigation between default and campaign dashboard layouts on desktop and mobile when shell/theme behavior changes. Existing E2E tests select modes. |
| Campaign navigation | Smoke-test Back/Forward, keyboard section links, and switching campaigns while a session editor is dirty. Deep breadcrumbs, core navigation, and admin history/mobile controls already have automated coverage. |
| Accessibility | Check 200% zoom and physical/coarse-pointer interaction in dense editors and canvas/media controls when those interfaces change. Preserve keyboard/focus, draft retention, retry, and reduced-motion behavior already checked. |
| Long transcripts | Measure load, editing, search, and playback seeking with a representative 4–6 hour transcript. Time-windowed rendering exists, but the old records do not establish measured performance for that acceptance criterion. |

The proposed removal of the `theme-*` compatibility layer remains conditional:
`AppHeader`, layouts, `maps/Viewer`, and other components still use it. Review
consumers before removal and preserve the identity in
[StyleGuide.md](../StyleGuide.md). The old page-audit fixes and component/data
migrations already delivered are not new backlog items.

## Build performance experiments

The February 2026 plan recorded one 646.87-second Windows build and an informal
Linux estimate of about four minutes. These are historical observations, not a
current baseline or a validated platform comparison. No new benchmark was run
during this review.

- Measure repeated builds with the same revision and toolchain; compare native
  Windows with Linux/WSL on the Linux filesystem if useful.
- Investigate production initialization of `@nuxt/test-utils` and `@nuxt/eslint`,
  which remain in `nuxt.config.ts`'s global modules list.
- Profile icon datasets, MDC/highlighter code, and MapLibre chunks before
  changing imports or bundling. Remeasure sizes and preserve markdown, map,
  icon, SSR, and offline behavior.

## Optional feature ideas

| Area | Deferred scope |
| --- | --- |
| Maps | Lasso or box selection beyond single-feature selection. |
| Calendar | Richer events, leap rules, moon phase visualization, session time-of-day ranges, and admin-managed templates. Configurable moon cycles already exist. |
| Journal | Realtime collaboration and advanced editor features beyond v1. |
| DM requests | Automatic inventory/quest creation after approval, or an inventory draft workflow. These were excluded from v1. |
| User management | SSO, a decision on required email verification, and broader activity analytics. Current DAU/WAU use `User.lastLoginAt`. |
| Transcript editor | Merge/split segments, waveform display, playback/search shortcuts, low-confidence highlighting, and forced alignment. Bulk speaker/selection tools, filters, Undo/Redo, confidence values, and seeking already exist. |

## Deployment verification carried forward

The archived Prisma upgrade records left container/staging startup, recording
upload/playback, provider transcription callbacks, and document version
restoration unconfirmed. Documentation cleanup did not validate an external
deployment. A release verification pass should cover those workflows in the
actual runtime image against staging database and artifact storage, alongside
the normal checks for the release revision. Current startup and recovery
behavior is described in [DeploymentRecovery.md](../docs/DeploymentRecovery.md).

Character sheet and import behavior is documented in
[Characters.md](../docs/Characters.md).
