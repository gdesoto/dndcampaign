# Code simplification plan

Updated: 2026-10-01. Historical validation baseline: `cd0ae54` on `master`; later source changes are noted below.

## Goal and constraints

Reduce duplicated decisions, unnecessary operations, and independently maintained state. Prefer deletion and reuse of existing domain code. Fewer lines, files, or endpoints alone do not establish a useful simplification. Proceed with a conditional ticket only when its concrete implementation reduces complexity without introducing more indirection or unnecessary work.

- Follow `AGENTS.md`. For frontend work, Nuxt UI Guidelines governs interaction/layout/accessibility; `StyleGuide.md` supplies project component contracts; the DM Vault style guide and `theme-guide.md` govern identity. Use the currently installed skill paths rather than a historical plugin-cache version. No unrelated visual redesign is included.
- Preserve authorization, explicit public response fields, validation, errors/retries, draft retention, conflicting-action guards, keyboard access, and focus behavior.
- Read `docs/SessionWorkspaceOwnership.md` before session work. Preserve one parent instance, pinned IDs, watcher disposal, same-session drafts, dirty exit guards, combined jobs, historical-response identity checks, exact-scope retained resources, and global playback lifetime.
- Keep URLs and payloads unless the selected scope explicitly changes them. Update `public/openapi.json` alongside any API behavior or contract change. No planned ticket requires a database migration.
- Do not introduce generic CRUD, configurable query-loader, serializer, media-controller, or state-management frameworks for these tickets. Do not retain or add abstractions solely for speculative future features.
- Findings establish source-level duplication or unnecessary work, not measured performance improvements. Recheck current callers before editing; ticket references use file and symbol names rather than stale line numbers.

## Completed work

The following table records completed and committed tickets. Additional completed work below records its own commit status. Completed tickets are not part of the open queue and do not need to be repeated or reconsidered as pending dependencies.

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

### 2026-10-01 dead-code cleanup

Removed the verified orphan encounter component, unused server methods and shared declarations, ignored component props and caller bindings, unreachable quest branches, unused global styles, and redundant direct devtools dependency. Updated the seed character to the current sheet format; existing character records remain unchanged. CJ-08 and CJ-20 still have the remaining work described below.

Validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (82 files / 293 tests), and `yarn build` (421.66s). The initial sandboxed build failed on a parent-directory metadata lookup; the permission-enabled retry succeeded. Tests exited successfully with a Vite shutdown warning, and dependency/bundler warnings remain. Offline installation succeeded with the existing frozen lockfile. Browser checks covered desktop/mobile light/dark themes, quest creation/groups/empty/no-matches states and keyboard focus, campaign activity, the corrected seed character and editor level, and session status-card/transcript-editor/summary navigation. The isolated browser database was removed afterward. Logs and screenshots are under `storage/dead-code-*`.

### 2026-10-01 CJ-10 — Campaign selection (complete, `2d2a875`)

Campaign selection now derives from the route. Both header controls invoke navigation only on explicit selection; the selected-ID ref, three synchronization watchers, and mount gate are gone. Pending/canceled navigation retains the current selection, selecting the same campaign preserves a deep route, and missing campaign options show a disabled `Current campaign` entry until the matching name is available. Loading, empty, or failed option lists never initiate navigation. The existing section resolver and dirty-exit guards remain in place; no API change.

Validation passed: `yarn lint`, `yarn typecheck`, and the campaign-selector, campaign-selector-route, and session-workspace-routes suites (3 files / 12 tests). The new selector suite uses two native controls and a real memory router for pending/canceled/successful navigation, Back/Forward, direct routes, same-target selection, and delayed/empty/failed/missing option lists. Browser checks against an isolated seeded database covered desktop/mobile selection and dirty-summary cancellation/acceptance, draft retention, missing-option display, Back/Forward, direct loading, keyboard selection, and reselecting the active campaign on a deep editor route. The test server was stopped and its database removed afterward. Logs and the desktop screenshot are under `storage/cj-10-*`. A full suite and production build were not run for this bounded navigation change.

### 2026-10-01 CJ-05/06/07 — Session workflow and dungeon projection (complete)

CJ-05: Transcript creation sends one empty POST only when missing. Removed the PATCH branch and mirrored transcript draft; import, deletion, summary editing, and error/retry behavior remain. Creation/import/deletion exclude duplicate and conflicting submissions. Create disappears once the document exists, and keyboard creation hands focus to Open editor unless the user has moved focus elsewhere.

CJ-06: Session controls now carry native destinations, including overview cards and panel links. Removed routing-event forwarding and unused timeline descriptions. Navigation items use pinned workspace IDs; invalid-step fallback, parent ownership, request counts, same-session drafts, and dirty exit guards remain.

CJ-07: Dungeon reads, exports, and the client preview use the existing pure player-safe projection from `shared/utils/dungeon-map.ts`. Secret-room geometry and attached entities are filtered consistently without changing projection semantics, authorization, or API contracts.

Validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (84 files / 300 tests), and `yarn build` (397.51s). Dependency bundler/deprecation warnings remain. Focused tests and independent review cover transcript creation/retry/conflicts/focus, native destinations and workspace ownership, and map projection immutability/idempotence/parity. Browser checks used an isolated seeded database for desktop/mobile, light/dark presentation, keyboard creation/editor access, deletion/recreation, new-tab links, Back/Forward, same-session draft retention, canceled/accepted dirty exits, and player-safe preview toggling with four secret rooms among eight rooms. The browser server was stopped and its database removed afterward. Logs and screenshots are under `storage/cj-05-07-*`.

## Open queue and sequencing

| Ticket | Disposition | Scope |
| --- | --- | --- |
| CJ-08 | Partially complete | Unused QuestCard props and unreachable empty branches removed; duplicate group rendering remains. |
| CJ-09 | Conditional; narrowed | Quest listing reuse only, subject to a clear simplification with explicit public fields. |
| CJ-11 | Small deletion ready; broader work conditional | Remove the unused session include; narrow other encounter reads only when query ownership stays simple. |
| CJ-12 | Coordinate with CJ-22 | Converge playback locally if URL endpoints stay; otherwise incorporate into CJ-22. |
| CJ-20 | Partially complete | Encounter, initiative, and turn actions use schemas; legacy combatant amount parsing remains. |
| CJ-21 | Conditional; narrowed | Share common map projection/parsing without private glossary enrichment; SVG reuse is optional. |
| CJ-22 | Roadmap decision first | Remove private playback-URL endpoints only after choosing the playback URL strategy. |

With CJ-05/06/07/10 complete, the next larger opportunity is **conditional playback work**. Before implementation, decide CJ-22: keep the endpoints and implement CJ-12, or remove them and complete both tickets together. Do not refactor caches in CJ-12 only to delete them in CJ-22 immediately afterward.

CJ-08 and CJ-20 can run independently. These priorities are not hard dependencies. CJ-09, broader CJ-11 query changes, and CJ-21 are not mandatory cleanup: defer them if the proposed implementation adds more machinery than it removes. CJ-11's unused session include can be deleted directly. Profiling can inform broader query-work priority, but is not required to establish that a query loads unused relations.

The signed-URL roadmap is **unresolved**. A future remote storage provider does not itself require browser-facing signed URLs; server streaming remains possible. This document neither commits to signed URLs nor authorizes endpoint removal before that decision.

## Execution and completion protocol

1. Read the selected ticket and current source; check all callers, Nuxt auto-import surfaces, and existing tests. Preserve unrelated working-tree changes.
2. Establish current contracts before changing behavior. Implement the smallest concrete deletion/reuse; do not expand into neighboring tickets without a reason tied to the goal.
3. After JavaScript/TypeScript/Vue changes, pass `yarn lint`, `yarn typecheck`, and relevant tests. Extend a few comprehensive workflow/contract tests rather than turning each acceptance item into a separate test. Pure unreachable-code deletions do not need invented behavior tests. Run the integrated `yarn test` for a completed multi-area batch.
4. Match browser checks to the affected behavior: keyboard navigation, direct URLs, Back/Forward, dirty guards, and failure recovery where applicable. Cover desktop/mobile controls when both are affected; check light/dark themes when presentation changes warrant it. A build is not browser verification.
5. Use one final production `yarn build` for an agreed implementation batch, or for a standalone change when packaging/rendering risk warrants it; do not rebuild after every small ticket. Allow approximately 8 minutes and wait for actual exit status through quiet Nitro packaging; do not mistake an early tool yield for a hang or completion.
6. Coordinate a single API test runner: suites share port 4181. Poll yielded command sessions to completion. Do not run competing API launchers or treat a cross-server result as a valid test verdict.
7. Review the final diff against acceptance criteria, correct gaps, and record actual checks, limitations, and commit when committed. Commit or merge according to the current user instruction; no historical per-ticket branch workflow is required. Rollback is a code revert.

## CJ-08 — Consolidate duplicate quest group rendering

**Completed cleanup (2026-10-01):** Removed unused `typeBadgeColor`/`trackBadgeColor` props, parent helpers/bindings, and unreachable group-empty branches. The real empty/no-matches handling remains in `SharedResourceState`.

**Remaining scope:** The private quests page still repeats card wiring for two groups. Use two small group descriptors and one section/card template, preserving group order. Retain real loading, empty, and no-matches behavior, permissions, handlers, confirmations, drafts, and calendar-sensitive expiration formatting.

**Files:** `app/components/campaign/QuestCard.vue` and `app/pages/campaigns/[campaignId]/quests.vue` only. Cross-page label centralization and a configurable card framework are outside this ticket.

**Acceptance:** Both groups, ordering, reader actions, expiration labels, create/edit flows, and existing state handling. Run `test/nuxt/campaign-quests-page.test.ts`, `test/nuxt/quest-form-schema.test.ts`, and mobile/keyboard checks. No API change.

## CJ-09 — Evaluate quest listing reuse with explicit public fields

**Disposition:** Conditional, quests only. Glossary and milestone unification is removed from scope; their private/public queries differ, and the public milestone query is already small. CJ-21 is a separate evaluation, not a dependency.

**Evidence:** `CampaignPublicAccessService.getPublicQuests` repeats quest listing and conversion in `QuestService.listCampaignQuests`. CJ-04 already derives private quest row types from a shared typed include; do not recreate that work.

**Scope:** After `resolvePublicAccess(publicSlug, 'quests')`, reuse the existing quest listing and project an explicit public field allowlist, or share a small common query/projection if that is simpler. Keep the public boundary explicit: do not use rest-omission of `campaignId`, spread private DTOs, or add a generic serializer. Defer if reuse adds more ceremony than the duplication it removes.

**Files:** `server/services/campaign-public-access.service.ts` and `server/services/quest.service.ts`; both routes and consumers retain their contracts.

**Acceptance:** Exact public keys, exclusion of private fields, unchanged private results, date/null/source-name handling, ordering, missing slug, and disabled section. Run `test/api/api.campaign-public-access.test.ts`, `test/api/api.quest-routes.test.ts`, and `test/nuxt/campaign-quests-page.test.ts`. No payload expansion or endpoint removal.

## CJ-11 — Narrow encounter reads where the result stays simple

**Disposition:** Deleting the unused session include is ready. Broader query narrowing is conditional and lower priority. Profiling may establish urgency or a measurable gain; it is not required to establish that unused relations are loaded. Do not claim a speedup without measurement.

**Evidence:** `getEncounterWithAccess` in `server/services/encounter/encounter-shared.ts` loads combatants, ordered event history, and session. No remaining caller consumes the included session relation. Some callers do need combatants/history; others query relations again. The unused runtime-board consumer is already removed.

**Scope:** Remove the unused session include without changing lookup ownership. Separately evaluate narrowing combatants/history reads while preserving the permission-scoped lookup and explicit loading at consumers that need those relations. Remove redundant reads, not required post-write reads. No boolean-mode loader or generic query framework. Defer the broader changes if they add substantial branching or scattered query machinery.

**Caller inventory to recheck:** `encounter.service.ts`: get/detail, combatant list/create/update/delete, event list, notes. `encounter-runtime.service.ts`: lifecycle transitions, initiative roll/reorder, turn movement/selection, damage/heal, and condition create/update/delete. `encounter-summary.service.ts`: summary. Preserve all existing ordering and permission results.

**Acceptance:** Unchanged detail/summary, missing/denied access, initiative/turns, HP, conditions, and notes. For broader query changes, verify unused history and duplicate reads are removed from the affected operations without adding a separate test for each query shape. Run `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`, and `test/unit/encounter-summary.test.ts` as relevant to the selected scope. Keep URLs/payloads unchanged. No dependency on CJ-20 endpoint consolidation, which is no longer planned here.

## CJ-12 — Converge playback locally if URL endpoints remain

**Disposition:** Coordinate with CJ-22 before implementation. If endpoints remain, execute this ticket after CJ-05/06. If endpoint removal is chosen, incorporate this work into CJ-22 and mark CJ-12 satisfied by that change rather than implementing it twice.

**Evidence:** `useSessionRecordings` and `useSessionRecap` duplicate `playSource` calls for cached/fetched URLs. The cached call sits outside the composable's catch, but `useMediaPlayer.playSource` normally catches media-play failures and reports them through player state; moving the call into a catch alone does not fix those failures. Recap identity can change during URL retrieval, including replacement of the artifact while the recap ID stays the same.

**Scope when retaining endpoints:** Resolve cached-or-fetched URL once, capture media identity including `artifactId` before awaits, and call the existing player once. Use common handling for URL-fetch failures and actual thrown errors; preserve and verify the player's own media-error reporting. Retain meaningful busy guards, caches, progress IDs, audio/video behavior, and drawer presentation. Do not add a generic media controller.

**Files:** `app/composables/useSessionRecordings.ts`, `useSessionRecap.ts`, and `shared/types/session-workflow.ts` for artifact identity already present in responses; inspect workspace/panel contracts and `useMediaPlayer`/`GlobalMediaPlayer` when validating state. URL-presence indicators must not be confused with proof of active playback; if changed, derive them from the existing player rather than adding another playing-state owner.

**Acceptance:** Cached/fresh/repeated playback, fetch rejection, real player-state errors/retry, concurrent clicks, and media replacement/kind changes during awaits, including a new artifact under the same recap ID. Extend existing playback workflows instead of relying only on a mocked rejecting `playSource`. Run `test/nuxt/session-recap-playback.test.ts`, `session-delete-recovery.test.ts`, and recording playback coverage. No API change on the endpoint-retention path.

## CJ-20 — Replace hand-parsed encounter actions with schemas

**Current progress:** Encounter PATCH uses `encounterPatchSchema` for lifecycle actions or ordinary field updates. Initiative and turn PATCH routes use `encounterInitiativeSchema` and `encounterTurnSchema`. These conversions are already implemented; do not repeat them.

**Remaining scope:** Keep the existing endpoints and preserve authorization and service dispatch. The legacy single-combatant PATCH still recognizes damage/heal operations manually and validates ordinary edits with `encounterCombatantUpdateSchema`. It remains an active compatibility endpoint, including the `encounter_combatant_update` MCP tool in `server/services/mcp.service.ts`; do not treat it as dead code. Any schema conversion must preserve or explicitly review its amount coercion and other accepted payloads. Do not move routes or rewrite client URLs as part of this ticket. Explicitly test/document changes to unknown actions, malformed bodies, error messages/fields, or parsing order.

**Separate amount step:** Combatant damage/heal currently uses `Number(rawBody.amount)`; existing shared amount schemas are strict numbers. Characterize numeric strings, booleans, missing/null values, fractions, and bounds before substituting validation. Preserve accepted coercion deliberately or document/test a reviewed tightening. This compatibility decision must not be hidden inside action-schema cleanup.

**Files:** `server/api/encounters/[encounterId]/index.patch.ts`, `initiative/index.patch.ts`, `turn/index.patch.ts`, `combatants/[combatantId].patch.ts`, and `shared/schemas/encounter.ts` as needed. Update OpenAPI for validation changes. Endpoint consolidation is outside scope and would need a separate concrete benefit assessment.

**Acceptance:** Preserve existing lifecycle, ordinary-edit, initiative, and turn coverage; extend the damage/heal workflow for validation, coercion decisions, access checks, and MCP compatibility. Run `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`, and relevant MCP/schema coverage without duplicating already-covered actions.

## CJ-21 — Share common map work without private glossary enrichment

**Disposition:** Conditional and independent of CJ-09. Do not implement the former plan to call the full private viewer and discard its extra work.

**Evidence:** Public and private map viewers duplicate manifest/coordinate parsing and feature projection. `MapService.getViewer` also queries glossary links/entries and computes private matching information that the public path does not need. Public routes resolve slugs/primary maps; private service methods use map IDs.

**Scope:** Evaluate a small common map projection/parsing function in the existing map domain. Keep private glossary enrichment on the private path. SVG retrieval reuse is optional: the current retrieval is small, and a wrapper or extra identity lookup may cost more than it removes. If sharing it is worthwhile, resolve public slug/primary identity within the authorized campaign and preserve missing-map/missing-SVG handling.

**Boundaries:** Keep `resolvePublicAccess(publicSlug, 'maps')`, explicit public fields, existing feature-property semantics, sorting, bounds/default layers, and public glossary-indicator behavior. Do not introduce public requests to private glossary queries, rest-spread private DTOs, or a generic loader with modes. Sharing code is optional if it fails the complexity test.

**Files:** `server/services/campaign-public-access.service.ts`, `server/services/map.service.ts`, and a small existing-domain utility if warranted. Private/public map routes retain URL and payload contracts.

**Acceptance:** Exact public/private map shapes, no additional glossary data or queries on public reads, slug/primary selection, disabled/missing public access, coordinate fallbacks, and feature order/properties. If SVG retrieval changes, also preserve bytes/content type/filename and missing-map/missing-file errors. Run public-access API coverage, `test/nuxt/map-viewer.test.ts`, and existing map parsing/SVG coverage relevant to the selected scope; extend only meaningful gaps.

## CJ-22 — Decide whether to remove private playback-URL endpoints

**Decision required before implementation:** Are browser-facing signed URLs a committed near-term feature? If yes, retain the URL endpoints and implement CJ-12 independently. If no, evaluate removing the present constant-URL lookup and complete CJ-12 with this ticket. A speculative future provider is not, by itself, a reason to preserve the lookup. No roadmap answer is recorded yet.

**Evidence:** Private recording/recap playback-URL routes query access and return `/api/artifacts/:artifactId/stream` with `expiresAt: null`; the relevant server responses already contain `artifactId`, but several client types omit it. The stream endpoint performs its own authorization. There are six private callers in total, including the two session composables. Current URL caches also drive panel text claiming media is playing. Recap replacement preserves the recap ID while changing its artifact.

**Scope if removal is chosen:** Update all six private callers to build the artifact stream URL from existing data, add the omitted artifact identity to their client types, then delete the two private URL routes and OpenAPI entries and obsolete fetch/cache/reset plumbing. Converge playback/error handling as in CJ-12. Distinguish a changed artifact from the same recap's progress ID when guarding awaits, reusing a loaded source, and showing playback indicators. Use existing player identity/state; keep only state needed for actual asynchronous player work. A shared URL builder is justified by current reuse, not as a speculative signed-URL framework.

**Files:** The two private playback-URL routes; all six callers: `app/composables/useSessionRecordings.ts`, `useSessionRecap.ts`, `useCampaignRecaps.ts`, and the campaign `recordings/[recordingId].vue`, `documents/[documentId].vue`, and `watch.vue` pages. Include `shared/types/session-workflow.ts`, `shared/types/campaign-overview.ts`, the document page's recording type, and `useRecapWatch`/`CampaignRecapWatch` contracts as needed, plus affected panel/view-model bindings, player error presentation, tests, and OpenAPI. The public recap playback-URL endpoint and public payload boundary remain outside this scope.

**Acceptance:** Cover the six private workflows, both media kinds, repeat playback, replacement/deletion, stale artifact identity, accurate indicators, and preserved global-player lifetime/progress/drawer behavior. Authorization and missing-media failures move from the lookup to the stream: verify real player-state errors and visible retry guidance for audio as well as video, rather than only mocking a rejecting `playSource`. Confirm retired-route behavior and no remaining private URL callers; extend existing recap API, watch/playlist, and session playback/deletion tests as needed. Do not run CJ-12 separately first if this removal path is selected.

## Outside the current scope

- Generic public/private unification for glossary, milestones, or journal. Distinct queries and visibility rules require their own justification.
- Removing encounter read endpoints merely to reduce route count. Schema cleanup in CJ-20 does not authorize this.
- Removing storage interfaces/factories or the Prisma generated-client boundary because they are thin.
- Replacing session ownership, retained resources, editor drafts, confirmation components, or global player state with generic frameworks.
- Broad page/component splitting, theme redesign, and unrelated cleanup. Revisit only with a concrete problem and bounded benefit.
