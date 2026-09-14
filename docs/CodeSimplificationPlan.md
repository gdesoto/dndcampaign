# Code simplification plan

Updated: 2026-09-13. Current application baseline: `cd0ae54` on `master`.

## Goal and constraints

Reduce duplicated decisions, unnecessary operations, and independently maintained state. Prefer deletion and reuse of existing domain code. Fewer lines, files, or endpoints alone do not establish a useful simplification. Proceed with a conditional ticket only when its concrete implementation reduces complexity without introducing more indirection or unnecessary work.

- Follow `AGENTS.md`. For frontend work, Nuxt UI Guidelines governs interaction/layout/accessibility; `StyleGuide.md` supplies project component contracts; the DM Vault style guide and `theme-guide.md` govern identity. Use the currently installed skill paths rather than a historical plugin-cache version. No unrelated visual redesign is included.
- Preserve authorization, explicit public response fields, validation, errors/retries, draft retention, conflicting-action guards, keyboard access, and focus behavior.
- Read `docs/SessionWorkspaceOwnership.md` before session work. Preserve one parent instance, pinned IDs, watcher disposal, same-session drafts, dirty exit guards, combined jobs, historical-response identity checks, exact-scope retained resources, and global playback lifetime.
- Keep URLs and payloads unless the selected scope explicitly changes them. Update `public/openapi.json` alongside any API behavior or contract change. No planned ticket requires a database migration.
- Do not introduce generic CRUD, configurable query-loader, serializer, media-controller, or state-management frameworks for these tickets. Do not retain or add abstractions solely for speculative future features.
- Findings establish source-level duplication or unnecessary work, not measured performance improvements. Recheck current callers before editing; ticket references use file and symbol names rather than stale line numbers.

## Completed work

These tickets are complete and committed. They are not part of the open queue and do not need to be repeated or reconsidered as pending dependencies.

| Ticket | Commit | Result |
| --- | --- | --- |
| CJ-01 | `6f67721` | Private artifact streaming reuses the range helper. Added clamping, explicit unsatisfiable-range handling, malformed/multiple-range fallback, and correct range advertising. Private 416 uses the JSON error envelope; public recap 416 remains empty. |
| CJ-02 | `99fb5e7` | Character import sections derive from the shared schema; client section type also reuses the shared type. |
| CJ-03 | `9403b91` | Removed unused recording upload/artifact reader methods; buffer artifact creation delegates to streaming persistence. Existing artifact persistence failure does not gain rollback. |
| CJ-04 | `cd0ae54` | Request, quest, calendar, and public-access row types derive from Prisma. Removed request result casts, identity conversion, and redundant policy projections. |
| CJ-13 | `2a6c78b` | Removed unused encounter runtime-board method and orphan types. |
| CJ-14 | `21524fd` | Removed the unused client public-overview wrapper; active public composable and server endpoint remain. |
| CJ-15 | `a9d4f48` | Removed duplicate account-profile endpoint and reused account mapping; retained `/api/auth/me` with its distinct response/session behavior. |
| CJ-16 | `c938322` | One transcription job DTO mapper; detail includes `tagAudioEvents`, documented in OpenAPI. |
| CJ-17 | `0fa857b` | Dev n8n endpoint uses the shared schema; removed shadow validator, optional-validation flag, and checkbox. |
| CJ-18 | `198fa8c` | Added `DocumentService.upsertForSession`. Create-only route retains 409; imports retain titles/recording semantics. Initial summary application now writes one version instead of two identical versions, documented in OpenAPI. |
| CJ-19 | `198fa8c` | Moved glossary PC linking, calendar month-view assembly, transcript application, and subtitle attachment into existing services. Local transcription operations do not construct an ElevenLabs client; handlers retain authorization. |
| CJ-23 | `3ae6bc3` | Removed unused `campaign.delete` permission and corresponding response/type declarations. |

Shared plumbing already in place: thrown `apiError` values and the central Nitro API error envelope; campaign-route authorization passed to services and permission-scoped child lookups; shared multipart reading; shared transcript/VTT conversion. Reuse these rather than reconstructing their predecessors.

### Recorded validation

Completed work used scoped Terra implementation and manager review; the initial batch also had independent Terra review. Application changes passed lint/typecheck and relevant tests. Final integrated checks were:

| Checkpoint | Full suite | Production build | Local ignored logs |
| --- | --- | --- | --- |
| Initial CJ-13/14/23/15/16/17/02 batch | 73 files / 302 tests | Exit 0, 403.75s | `storage/cj-batch-test.log`, `storage/cj-batch-build.log` |
| CJ-03 | 75 files / 309 tests | Exit 0, 473.92s | `storage/cj-03-test.log`, `storage/cj-03-build.log` |
| CJ-01 | 75 files / 336 tests | Exit 0, 397.09s | `storage/cj-01-test.log`, `storage/cj-01-build.log` |
| CJ-18/19 | 78 files / 347 tests | Exit 0, 412.64s | `storage/cj-18-19-test.log`, `storage/cj-18-19-build.log` |
| CJ-04 | 78 files / 347 tests | Exit 0, 429.17s | `storage/cj-04-test.log`, `storage/cj-04-build.log` |

CJ-17 also received desktop/mobile, light/dark browser verification with local webhook fixtures. No external n8n, ElevenLabs, or DnD Beyond call was needed for these checks. Non-blocking dependency bundler/deprecation warnings remained. Completed builds supersede earlier interrupted attempts. Validation counts describe those checkpoints, not promises about subsequent work.

## Open queue and sequencing

| Ticket | Disposition | Scope |
| --- | --- | --- |
| CJ-05 | Ready | Make session transcript creation creation-only; remove unused mirrored transcript draft. |
| CJ-06 | Ready after CJ-05 | Replace session navigation event forwarding with native destinations. |
| CJ-07 | Ready; independent | Share the existing player-safe dungeon projection. |
| CJ-08 | Ready; narrowed | Remove unused QuestCard props and duplicate group rendering only. |
| CJ-09 | Conditional; narrowed | Quest listing reuse only, subject to a clear simplification with explicit public fields. |
| CJ-10 | Ready; separate review | Make route state own campaign selection; explicitly test navigation behavior changes. |
| CJ-11 | Conditional; lower priority | Remove unused encounter relation reads when the resulting query ownership stays simple. |
| CJ-12 | Coordinate with CJ-22 | Converge playback locally if URL endpoints stay; otherwise incorporate into CJ-22. |
| CJ-20 | Ready; rescoped | Replace hand-parsed actions with schemas on existing endpoints. Treat amount compatibility as a separate step. |
| CJ-21 | Conditional; redesigned | Share common map projection/parsing and SVG retrieval without private glossary enrichment. |
| CJ-22 | Roadmap decision first | Remove private playback-URL endpoints only after choosing the playback URL strategy. |

Recommended session sequence: **CJ-05 → CJ-06 → playback work**. Before playback work, decide CJ-22: keep the endpoints and implement CJ-12, or remove them and complete both tickets together. Do not refactor caches in CJ-12 only to delete them in CJ-22 immediately afterward.

CJ-07 and CJ-08 can run independently. Give CJ-10 its own review and browser pass; placing it after the session batch is sensible risk management, not a dependency. CJ-20 can run independently of frontend work. CJ-09, CJ-11, and CJ-21 are not mandatory cleanup: defer them if the proposed implementation adds more machinery than it removes. Profiling can inform CJ-11 priority, but is not required to establish that a query loads unused relations.

The signed-URL roadmap is **unresolved**. A future remote storage provider does not itself require browser-facing signed URLs; server streaming remains possible. This document neither commits to signed URLs nor authorizes endpoint removal before that decision.

## Execution and completion protocol

1. Read the selected ticket and current source; check all callers, Nuxt auto-import surfaces, and existing tests. Preserve unrelated working-tree changes.
2. Establish current contracts before changing behavior. Implement the smallest concrete deletion/reuse; do not expand into neighboring tickets without a reason tied to the goal.
3. After JavaScript/TypeScript/Vue changes, pass `yarn lint`, `yarn typecheck`, and relevant tests. Pure unreachable-code deletions do not need invented behavior tests. Run the integrated `yarn test` for a completed multi-area batch.
4. For UI changes, inspect the affected interactions at desktop/mobile widths and in light/dark themes. Test keyboard navigation, direct URLs, Back/Forward, dirty guards, and failure recovery where applicable. A build is not browser verification.
5. Run one production `yarn build` after the selected ticket or agreed batch is complete. Allow approximately 8 minutes and wait for actual exit status through quiet Nitro packaging; do not mistake an early tool yield for a hang or completion.
6. Coordinate a single API test runner: suites share port 4181. Poll yielded command sessions to completion. Do not run competing API launchers or treat a cross-server result as a valid test verdict.
7. Review the final diff against acceptance criteria, correct gaps, and record actual checks, limitations, and commit when committed. Commit or merge according to the current user instruction; no historical per-ticket branch workflow is required. Rollback is a code revert.

## CJ-05 — Remove the transcript workspace's unused editing mode

**Evidence:** `useSessionDocuments` creates or PATCHes the transcript, but the session workflow invokes it as Create. `TranscriptPanel` exposes Create even when a transcript exists. `useSessionWorkspaceViewModel` mirrors transcript content despite having no transcript input. Existing content already has a document-editor link.

**Scope:** Create an empty transcript only when missing. Hide or disable Create when one exists and guard duplicate/conflicting submissions locally. Remove the PATCH branch, mirrored transcript form/ref/watch, and `transcriptContent` option. Keep the summary draft, editor link, import/delete, errors, retries, and busy protection. Continue using the create-only endpoint and its 409 behavior; do not use the new server upsert for this action.

**Files:** `app/composables/useSessionDocuments.ts`, `useSessionWorkspaceViewModel.ts`, `app/components/session/TranscriptPanel.vue`, and `app/pages/campaigns/[campaignId]/sessions/[sessionId]/[step].vue`. Update ownership documentation only if its contract description changes. No backend/API change.

**Acceptance:** One empty POST when missing; no create/PATCH when present; error/retry and double-submit behavior; editor link and import/delete recovery. Extend `test/nuxt/session-panels.test.ts`; run `session-delete-recovery.test.ts` and `session-workspace-routes.test.ts`.

## CJ-06 — Replace session navigation event chains with native links

**Evidence:** `StepLinkButton`, `StatusCards`, `RecordingsPanel`, and `RecapPanel` forward navigation events to `useSessionWorkspaceViewModel.openSessionSection`. `WorkflowTimeline` already uses native links. Routing-only forwarding does not need a separate state owner.

**Scope:** Supply destinations through `to`, retaining tooltip/accessibility presentation. Delete routing-only `open`, `open-step`, `jump-step`, and `openSessionSection` plumbing and confirmed unused props/descriptions. Keep invalid-step correction and `defaultStep` fallback. Preserve parent ownership and dirty exit guards; do not replace action events unrelated to navigation.

**Files:** Session `StepLinkButton`, `StatusCards`, `RecordingsPanel`, `RecapPanel`, and `WorkflowTimeline`; workspace view model; session overview/step/parent routes as needed; `docs/SessionWorkspaceOwnership.md`. No API change.

**Acceptance:** Correct hrefs, keyboard/new-tab behavior, retained same-session drafts, guarded exits, unchanged workspace instance/request counts. Update `test/nuxt/session-panels.test.ts` to assert destinations; run `session-workspace-routes.test.ts` and browser checks. Complete after CJ-05 to avoid overlapping edits.

## CJ-07 — Share the existing player-safe dungeon projection

**Evidence:** `server/services/dungeon/dungeon-map-utils.ts` defines `toPlayerSafeMap`; the dungeon detail page duplicates room/corridor/door filtering but omits attached-entity filtering. `MapCanvas` already skips markers whose rooms are absent, so this is data parity and maintenance work, not evidence of a visible secret leak.

**Scope:** Move the existing pure projection to `shared/utils/dungeon-map.ts` and use it from the dungeon service, export service, and client preview. Preserve server authorization and existing projection semantics; do not redefine what player-safe means or change unrelated map fields.

**Files:** `server/services/dungeon/dungeon-map-utils.ts`, `dungeon.service.ts`, `dungeon-export.service.ts`, `app/pages/campaigns/[campaignId]/dungeons/[dungeonId].vue`, and the new shared utility. Keep `shared/types/dungeon.ts` contracts unchanged.

**Acceptance:** Secret rooms, incident corridors/doors, attached entities, no input mutation, idempotence, and client/server projection parity. Add focused pure tests; run `test/nuxt/dungeons-pages.test.ts` and export coverage in `test/api/api.dungeon-routes.test.ts`.

## CJ-08 — Remove unused QuestCard props and duplicate group rendering

**Evidence:** `QuestCard` declares unused `typeBadgeColor`/`trackBadgeColor` callbacks. The private quests page repeats card wiring for two groups and contains empty branches made unreachable by outer nonempty checks.

**Scope:** Remove those props/functions/bindings. Use two small group descriptors and one section/card template, preserving group order and removing unreachable branches. Retain real loading, empty, and no-matches behavior, permissions, handlers, confirmations, drafts, and calendar-sensitive expiration formatting.

**Files:** `app/components/campaign/QuestCard.vue` and `app/pages/campaigns/[campaignId]/quests.vue` only. Cross-page label centralization and a configurable card framework are outside this ticket.

**Acceptance:** Both groups, ordering, reader actions, expiration labels, create/edit flows, and existing state handling. Run `test/nuxt/campaign-quests-page.test.ts`, `test/nuxt/quest-form-schema.test.ts`, and mobile/keyboard checks. No API change.

## CJ-09 — Evaluate quest listing reuse with explicit public fields

**Disposition:** Conditional, quests only. Glossary and milestone unification is removed from scope; their private/public queries differ, and the public milestone query is already small. CJ-21 is a separate evaluation, not a dependency.

**Evidence:** `CampaignPublicAccessService.getPublicQuests` repeats quest listing and conversion in `QuestService.listCampaignQuests`. CJ-04 already derives private quest row types from a shared typed include; do not recreate that work.

**Scope:** After `resolvePublicAccess(publicSlug, 'quests')`, reuse the existing quest listing and project an explicit public field allowlist, or share a small common query/projection if that is simpler. Keep the public boundary explicit: do not use rest-omission of `campaignId`, spread private DTOs, or add a generic serializer. Defer if reuse adds more ceremony than the duplication it removes.

**Files:** `server/services/campaign-public-access.service.ts` and `server/services/quest.service.ts`; both routes and consumers retain their contracts.

**Acceptance:** Exact public keys, exclusion of private fields, unchanged private results, date/null/source-name handling, ordering, missing slug, and disabled section. Run `test/api/api.user-management-um5-public-access.test.ts`, `test/api/api.quest-routes.test.ts`, and `test/nuxt/campaign-quests-page.test.ts`. No payload expansion or endpoint removal.

## CJ-10 — Make the router own campaign selection

**Evidence:** `useCampaignSelector` mirrors the route in a selected-ID ref, three watches, and a mount gate. A canceled navigation can leave the selection ahead of the route; an empty/loading list can indirectly initiate navigation.

**Scope:** Derive selection from the route. Only user selection invokes the existing `resolveCampaignSelectorRoute` and router. Remove synchronization watches/mount gate. A missing route ID in the fetched options must remain intelligible without pretending another campaign is selected.

**Deliberate correction:** Empty, loading, or failed lists no longer redirect on their own. Canceled navigation leaves the actual route selected. Review this behavior explicitly and separately from mechanical cleanup.

**Files:** `app/composables/useCampaignSelector.ts` and its desktop/mobile bindings in `app/components/AppHeader.vue`. Preserve the route resolver and existing guards. No API change.

**Acceptance:** Successful/canceled navigation, Back/Forward, delayed/empty/error lists, absent option, same-target selection, and desktop/mobile synchronization. Retain `test/unit/campaign-selector-route.test.ts`, add focused navigation coverage, and exercise dirty-editor exits in the browser. Can follow the session batch; no hard dependency on other tickets.

## CJ-11 — Narrow encounter reads where the result stays simple

**Disposition:** Conditional and lower priority. Profiling may establish urgency or a measurable gain; it is not required to establish that unused relations are loaded. Do not claim a speedup without measurement.

**Evidence:** `getEncounterWithAccess` in `server/services/encounter/encounter-shared.ts` loads combatants, ordered event history, and session for many mutations. Some callers then query relations again. The unused runtime-board consumer is already removed.

**Scope:** Preserve the permission-scoped lookup while loading relations explicitly at consumers that need them. Remove redundant reads, not required post-write reads. No boolean-mode loader or generic query framework. Defer if the replacement adds substantial branching or scattered query machinery.

**Caller inventory to recheck:** `encounter.service.ts`: get/detail, combatant list/create/update/delete, event list, notes. `encounter-runtime.service.ts`: lifecycle transitions, initiative roll/reorder, turn movement/selection, damage/heal, and condition create/update/delete. `encounter-summary.service.ts`: summary. Preserve all existing ordering and permission results.

**Acceptance:** Unchanged detail/summary, missing/denied access, initiative/turns, HP, conditions, and notes. Focused query assertions should show mutations do not load unused history and list operations avoid duplicate reads. Run `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`, and `test/unit/encounter-summary.test.ts`. Keep URLs/payloads unchanged. No dependency on CJ-20 endpoint consolidation, which is no longer planned here.

## CJ-12 — Converge playback locally if URL endpoints remain

**Disposition:** Coordinate with CJ-22 before implementation. If endpoints remain, execute this ticket after CJ-05/06. If endpoint removal is chosen, incorporate this work into CJ-22 and mark CJ-12 satisfied by that change rather than implementing it twice.

**Evidence:** `useSessionRecordings` and `useSessionRecap` duplicate `playSource` calls for cached/fetched URLs. Cached-path player failures bypass the common error path; recap identity can change during URL retrieval.

**Scope when retaining endpoints:** Resolve cached-or-fetched URL once, capture media identity before awaits, and call the existing player under common error handling. Preserve meaningful busy guards, caches, progress IDs, audio/video behavior, and drawer presentation. Do not add a generic media controller.

**Files:** `app/composables/useSessionRecordings.ts` and `useSessionRecap.ts`; inspect workspace/panel contracts when validating state. URL-presence indicators must not be confused with proof of active playback; if changed, derive them from the existing player rather than adding another playing-state owner.

**Acceptance:** Cached/fresh/repeated playback, fetch rejection, player rejection/retry, concurrent clicks, and media replacement/kind changes during awaits. Run `test/nuxt/session-recap-playback.test.ts`, `session-delete-recovery.test.ts`, and recording playback coverage. No API change on the endpoint-retention path.

## CJ-20 — Replace hand-parsed encounter actions with schemas

**Scope:** Keep the existing encounter, initiative, turn, and combatant endpoints. Replace manual action parsing/casts with typed schemas and discriminated action unions where applicable, reusing existing payload schemas. Preserve authorization and service dispatch. Do not move initiative/turn routes or rewrite client URLs as part of this ticket.

**Current contract:** The encounter PATCH manually recognizes lifecycle actions and otherwise handles ordinary field updates; it does not already have a complete action union. Preserve ordinary update requests alongside lifecycle actions. Explicitly test/document any change to unknown actions, malformed bodies, error messages/fields, or parsing order rather than silently broadening validation.

**Separate amount step:** Combatant damage/heal currently uses `Number(rawBody.amount)`; existing shared amount schemas are strict numbers. Characterize numeric strings, booleans, missing/null values, fractions, and bounds before substituting validation. Preserve accepted coercion deliberately or document/test a reviewed tightening. This compatibility decision must not be hidden inside action-schema cleanup.

**Files:** `server/api/encounters/[encounterId]/index.patch.ts`, `initiative/index.patch.ts`, `turn/index.patch.ts`, `combatants/[combatantId].patch.ts`, and `shared/schemas/encounter.ts` as needed. Update OpenAPI for validation changes. Endpoint consolidation is outside scope and would need a separate concrete benefit assessment.

**Acceptance:** Lifecycle actions, ordinary edits, initiative roll/reorder, advance/rewind/set-active, damage/heal, invalid actions/payloads, coercion decisions, and access checks. Run `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`, and focused schema tests.

## CJ-21 — Share common map work without private glossary enrichment

**Disposition:** Conditional and independent of CJ-09. Do not implement the former plan to call the full private viewer and discard its extra work.

**Evidence:** Public and private map viewers duplicate manifest/coordinate parsing and feature projection. `MapService.getViewer` also queries glossary links/entries and computes private matching information that the public path does not need. Public routes resolve slugs/primary maps; private service methods use map IDs.

**Scope:** Share a small common map projection/parsing function and appropriate SVG retrieval in the existing map domain. Keep private glossary enrichment on the private path. Resolve public slug/primary identity within the authorized campaign before reuse, preserving missing-map/missing-SVG handling. Reuse existing SVG service logic only where doing so avoids duplicated work rather than adding avoidable lookups.

**Boundaries:** Keep `resolvePublicAccess(publicSlug, 'maps')`, explicit public fields, existing feature-property semantics, sorting, bounds/default layers, and public glossary-indicator behavior. Do not introduce public requests to private glossary queries, rest-spread private DTOs, or a generic loader with modes. Sharing code is optional if it fails the complexity test.

**Files:** `server/services/campaign-public-access.service.ts`, `server/services/map.service.ts`, and a small existing-domain utility if warranted. Private/public map routes retain URL and payload contracts.

**Acceptance:** Exact public/private map shapes, no additional glossary data or queries on public reads, slug/primary selection, disabled/missing public access, coordinate fallbacks, feature order/properties, SVG bytes/content type/filename, and missing-map/missing-file errors. Run public-access API coverage, `test/nuxt/map-viewer.test.ts`, and focused map parsing/SVG coverage where existing tests are insufficient.

## CJ-22 — Decide whether to remove private playback-URL endpoints

**Decision required before implementation:** Are browser-facing signed URLs a committed near-term feature? If yes, retain the URL endpoints and implement CJ-12 independently. If no, evaluate removing the present constant-URL lookup and complete CJ-12 with this ticket. A speculative future provider is not, by itself, a reason to preserve the lookup. No roadmap answer is recorded yet.

**Evidence:** Private recording/recap playback-URL routes query access and return `/api/artifacts/:artifactId/stream` with `expiresAt: null`; session DTOs already contain `artifactId`. The stream endpoint performs its own authorization. Current URL caches also drive panel text claiming media is playing.

**Scope if removal is chosen:** Build the artifact stream URL from existing data, delete the two private URL routes and OpenAPI entries, and remove obsolete fetch/cache/reset plumbing. Converge playback/error handling as in CJ-12. Use existing player identity/state for playback indicators; keep only state needed for actual asynchronous player work. A shared URL builder is justified by current reuse, not as a speculative signed-URL framework.

**Files:** `server/api/recordings/[recordingId]/playback/url/index.get.ts`, `server/api/recaps/[recapId]/playback/url/index.get.ts`, both session playback composables, affected panel/view-model bindings, tests, and OpenAPI. The public recap playback-URL endpoint is outside this scope.

**Acceptance:** Both media kinds, repeat playback, replacement/deletion, stale identity, player failures/retry, accurate indicators, preserved global-player lifetime/progress/drawer behavior, and denied/missing media. Authorization failures move from the removed lookup to stream playback; verify understandable failure handling there. Confirm retired-route behavior and no remaining private URL callers; adapt recap API and session playback/deletion tests. Do not run CJ-12 separately first if this removal path is selected.

## Outside the current scope

- Generic public/private unification for glossary, milestones, or journal. Distinct queries and visibility rules require their own justification.
- Removing encounter read endpoints merely to reduce route count. Schema cleanup in CJ-20 does not authorize this.
- Removing storage interfaces/factories or the Prisma generated-client boundary because they are thin.
- Replacing session ownership, retained resources, editor drafts, confirmation components, or global player state with generic frameworks.
- Broad page/component splitting, theme redesign, and unrelated cleanup. Revisit only with a concrete problem and bounded benefit.
