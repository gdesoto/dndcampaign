# Code simplification plan

Updated: 2026-10-02. Historical validation baseline: `cd0ae54` on `master`; later source changes are noted below.

## Goal and constraints

Reduce duplicated decisions, unnecessary operations, and independently maintained state. Prefer deletion and reuse of existing domain code. Fewer lines, files, or endpoints alone do not establish a useful simplification. Proceed with a conditional ticket only when its concrete implementation reduces complexity without introducing more indirection or unnecessary work.

- Follow `AGENTS.md`. For frontend work, Nuxt UI Guidelines governs interaction/layout/accessibility; `StyleGuide.md` supplies project component contracts and DM Vault identity. Use the currently installed skill paths rather than a historical plugin-cache version. No unrelated visual redesign is included.
- Preserve authorization, explicit public response fields, validation, errors/retries, draft retention, conflicting-action guards, keyboard access, and focus behavior.
- Read `docs/SessionWorkspaceOwnership.md` before session work. Preserve one parent instance, pinned IDs, watcher disposal, same-session drafts, dirty exit guards, combined jobs, historical-response identity checks, exact-scope retained resources, and global playback lifetime.
- Keep URLs and payloads unless the selected scope explicitly changes them. Update `public/openapi.json` alongside any API behavior or contract change. No planned ticket requires a database migration.
- Do not introduce generic CRUD, configurable query-loader, serializer, media-controller, or state-management frameworks for these tickets. Do not retain or add abstractions solely for speculative future features.
- Findings establish source-level duplication or unnecessary work, not measured performance improvements. Recheck current callers before editing; ticket references use file and symbol names rather than stale line numbers.

## Completed work

The following table records all 19 completed tickets. Detailed completion and validation records follow. Only CJ-09, CJ-11, CJ-20, and CJ-21 remain in the open queue; completed tickets do not need to be repeated or reconsidered as pending dependencies.

| Ticket | Commit | Result |
| --- | --- | --- |
| CJ-01 | `6f67721` | Private artifact streaming reuses the range helper. Added clamping, explicit unsatisfiable-range handling, malformed/multiple-range fallback, and correct range advertising. Private 416 uses the JSON error envelope; public recap 416 remains empty. |
| CJ-02 | `99fb5e7` | Character import sections derive from the shared schema; client section type also reuses the shared type. |
| CJ-03 | `9403b91` | Removed unused recording upload/artifact reader methods; buffer artifact creation delegates to streaming persistence. Existing artifact persistence failure does not gain rollback. |
| CJ-04 | `cd0ae54` | Request, quest, calendar, and public-access row types derive from Prisma. Removed request result casts, identity conversion, and redundant policy projections. |
| CJ-05 | `a2935f0` | Transcript creation uses one empty POST only when missing; removed the mirrored draft and unused update branch. |
| CJ-06 | `a2935f0` | Session controls use native destinations; removed routing-event forwarding while preserving workspace ownership and dirty guards. |
| CJ-07 | `a2935f0` | Dungeon reads, exports, and preview share the existing player-safe projection. |
| CJ-08 | This commit | Two local quest-group descriptors share one section/card template, preserving group order, card actions, filtering, and calendar expiration labels. |
| CJ-10 | `2d2a875` | Campaign selection derives from the route; removed duplicated selection state and synchronization watchers. |
| CJ-12 | `b4fa8b6` | Playback uses the existing player's error/retry and source-identity handling; indicators reflect actual playback. |
| CJ-13 | `2a6c78b` | Removed unused encounter runtime-board method and orphan types. |
| CJ-14 | `21524fd` | Removed the unused client public-overview wrapper; active public composable and server endpoint remain. |
| CJ-15 | `a9d4f48` | Removed duplicate account-profile endpoint and reused account mapping; retained `/api/auth/me` with its distinct response/session behavior. |
| CJ-16 | `c938322` | One transcription job DTO mapper; detail includes `tagAudioEvents`, documented in OpenAPI. |
| CJ-17 | `0fa857b` | Dev n8n endpoint uses the shared schema; removed shadow validator, optional-validation flag, and checkbox. |
| CJ-18 | `198fa8c` | Added `DocumentService.upsertForSession`. Create-only route retains 409; imports retain titles/recording semantics. Initial summary application now writes one version instead of two identical versions, documented in OpenAPI. |
| CJ-19 | `198fa8c` | Moved glossary PC linking, calendar month-view assembly, transcript application, and subtitle attachment into existing services. Local transcription operations do not construct an ElevenLabs client; handlers retain authorization. |
| CJ-22 | `b4fa8b6` | All six private callers use existing artifact IDs; removed private playback-URL endpoints and caches, preserving the public boundary. |
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

### 2026-10-01 dead-code cleanup (complete, `e26dcdb`)

Removed the verified orphan encounter component, unused server methods and shared declarations, ignored component props and caller bindings, unreachable quest branches, unused global styles, and redundant direct devtools dependency. Updated the seed character to the current sheet format; existing character records remain unchanged. CJ-08's remaining group rendering was completed on 2026-10-02; CJ-20 still has the work described below.

Validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (82 files / 293 tests), and `yarn build` (421.66s). The initial sandboxed build failed on a parent-directory metadata lookup; the permission-enabled retry succeeded. Tests exited successfully with a Vite shutdown warning, and dependency/bundler warnings remain. Offline installation succeeded with the existing frozen lockfile. Browser checks covered desktop/mobile light/dark themes, quest creation/groups/empty/no-matches states and keyboard focus, campaign activity, the corrected seed character and editor level, and session status-card/transcript-editor/summary navigation. The isolated browser database was removed afterward. Logs and screenshots are under `storage/dead-code-*`.

### 2026-10-01 CJ-10 — Campaign selection (complete, `2d2a875`)

Campaign selection now derives from the route. Both header controls invoke navigation only on explicit selection; the selected-ID ref, three synchronization watchers, and mount gate are gone. Pending/canceled navigation retains the current selection, selecting the same campaign preserves a deep route, and missing campaign options show a disabled `Current campaign` entry until the matching name is available. Loading, empty, or failed option lists never initiate navigation. The existing section resolver and dirty-exit guards remain in place; no API change.

Validation passed: `yarn lint`, `yarn typecheck`, and the campaign-selector, campaign-selector-route, and session-workspace-routes suites (3 files / 12 tests). The new selector suite uses two native controls and a real memory router for pending/canceled/successful navigation, Back/Forward, direct routes, same-target selection, and delayed/empty/failed/missing option lists. Browser checks against an isolated seeded database covered desktop/mobile selection and dirty-summary cancellation/acceptance, draft retention, missing-option display, Back/Forward, direct loading, keyboard selection, and reselecting the active campaign on a deep editor route. The test server was stopped and its database removed afterward. Logs and the desktop screenshot are under `storage/cj-10-*`. A full suite and production build were not run for this bounded navigation change.

### 2026-10-01 CJ-05/06/07 — Session workflow and dungeon projection (complete, `a2935f0`)

CJ-05: Transcript creation sends one empty POST only when missing. Removed the PATCH branch and mirrored transcript draft; import, deletion, summary editing, and error/retry behavior remain. Creation/import/deletion exclude duplicate and conflicting submissions. Create disappears once the document exists, and keyboard creation hands focus to Open editor unless the user has moved focus elsewhere.

CJ-06: Session controls now carry native destinations, including overview cards and panel links. Removed routing-event forwarding and unused timeline descriptions. Navigation items use pinned workspace IDs; invalid-step fallback, parent ownership, request counts, same-session drafts, and dirty exit guards remain.

CJ-07: Dungeon reads, exports, and the client preview use the existing pure player-safe projection from `shared/utils/dungeon-map.ts`. Secret-room geometry and attached entities are filtered consistently without changing projection semantics, authorization, or API contracts.

Validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (84 files / 300 tests), and `yarn build` (397.51s). Dependency bundler/deprecation warnings remain. Focused tests and independent review cover transcript creation/retry/conflicts/focus, native destinations and workspace ownership, and map projection immutability/idempotence/parity. Browser checks used an isolated seeded database for desktop/mobile, light/dark presentation, keyboard creation/editor access, deletion/recreation, new-tab links, Back/Forward, same-session draft retention, canceled/accepted dirty exits, and player-safe preview toggling with four secret rooms among eight rooms. The browser server was stopped and its database removed afterward. Logs and screenshots are under `storage/cj-05-07-*`.

### 2026-10-01 CJ-12/22 — Private playback (complete, `b4fa8b6`)

All six private playback flows now construct the authorized artifact stream URL from the artifact ID already present in their media response. Removed the two private playback-URL routes, their OpenAPI entries, and obsolete URL caches and fetch/reset plumbing. The public recap URL endpoint and explicit public response fields remain unchanged.

The existing global player owns loading, playback failures, and Retry across inline, mini, and drawer controls. Native play promises replace duplicate readiness listeners and the arbitrary play throttle. Source identity includes ID, artifact URL, and media kind; recap progress remains keyed by recap ID. Playing indicators reflect actual player state, stale selections cannot overwrite current playback, successful deletion stops only the deleted source, and transcript ranges seek once and cannot pause a newer source. Mobile browser checks exposed the fixed mini player covering page actions; its measured height now reserves layout space, including wrapped errors.

Validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (86 files / 311 tests), `yarn build` (411.00s), and focused player/session/watch/playlist/recording/document tests. Non-blocking dependency bundler/deprecation warnings remain. Independent review found no actionable issues. Browser checks covered all six private callers, public playlist/watch, actual audio/video stream failures and Retry, drawer continuity, replacement under the same recap ID, saved progress, transcript segment start/end, desktop/mobile, light/dark, and keyboard/pointer controls. The isolated browser server was stopped and its database and uploaded files removed. Logs and screenshots are under `storage/cj-12-22-*`.

**Focused follow-up (2026-10-01):** Removed caller-owned playback flags and catch/reset branches; session and campaign controls now derive pending/error state from the matching global source. The watch page delegates same-source handling to the player, and volume/speed no longer have duplicate synchronization watchers. The player catches setup failures as well as native play failures. Its first empty element attachment no longer invalidates a pending public recap lookup, fixing a startup race found in browser verification. Upload/delete state, asynchronous public URL resolution guards, and exact-source deletion protection remain local to their actual owners.

Test cleanup removed a redundant video MIME case, duplicate status assertions, synthetic caller playback rejections, unused mock state, and the selector test's duplicate control. Dungeon preview assertions now use explicit expected visible entities instead of the production projection helper. Existing player workflows cover setup failure/Retry and preserve pending public lookups through initial mount and play-promise rejection; no test files or test cases were added. Application code is net 53 lines smaller and tests are net 5 lines smaller than `b4fa8b6`.

Follow-up validation passed: `yarn lint`, `yarn typecheck`, `yarn test` (86 files / 310 tests), and final `yarn build` (396.45s). Independent review's play-token settlement finding was corrected before these final checks; the earlier build was intentionally stopped. Browser checks covered mobile audio failure/Retry, audio/video switching, drawer continuity, volume/speed, recording indicators, same-source watch continuity, public watch startup/playback, and transcript segment start/end. The isolated server, database, and media were cleaned up. Existing dependency warnings remain; logs and screenshots are under `storage/cj-playback-cleanup-*`.

### 2026-10-02 CJ-08 — Quest group rendering (complete)

The private quests page now derives two local group descriptors and renders one section/card template. Empty groups are omitted, active/on-hold quests remain before completed/failed quests, and each group preserves the API's quest order. Card bindings, permissions, handlers, confirmations, forms, expiration formatting, and `SharedResourceState` remain in place. No new component, composable, API change, or database migration. Application code is net 21 lines smaller. The earlier unused-prop and unreachable-branch cleanup remains complete.

Extended the existing page workflow test to cover all four statuses, group/item order and counts, editing from both groups, status changes between groups, omission of an empty group after filtering, and reader permissions. Validation passed: `yarn lint`, `yarn typecheck`, and the quest page/form-schema suites (2 files / 7 tests). Browser checks against an isolated seeded database covered desktop and mobile, light/dark themes, keyboard status changes and editing, closed-group edit/save, mobile creation, no-matches/clear-filter recovery, calendar expiration labels, delete-confirmation cancellation/focus restoration, and reader presentation in both groups. No browser console errors were observed. The temporary server and database were cleaned up; logs and screenshots are under `storage/cj-08-*`. A full suite and production build were not run for this bounded template refactor.

### 2026-10-02 — Test suite consolidation (complete)

Thirteen Nuxt test files became five suites for shared controls, character
components, calendar, API keys, and encounter detail: eight fewer files. AST
comparison preserved all 29 original test definitions, 30 executed cases, and
122 assertion expressions. Encounter component stubs are mount-local and its
scroll override is restored after each case.

Full validation exposed cold-initialization timeouts in existing Markdown and
recap workflows. API setup now uses the managed server's rendered-login readiness
so page-fallback compilation completes before cases begin. Markdown's actual
first rendering fixture initializes in its existing setup hook, retaining all
three cases and 21 assertion expressions. Test and hook budgets were not changed.

Validation passed: `yarn test` (78 files / 310 tests: unit 59, Nuxt 147, API 104),
`yarn lint`, `yarn typecheck`, and `git diff --check`. Final logs are under
`storage/test-consolidation-final-{test,lint,typecheck}.log`. E2E files received a
read-only review; browser tests and a production build were not run for these
test-only changes. Four follow-up reviews by test type are recorded in
[FollowUps.md](FollowUps.md#test-suite-review); their additional proposals remain
unimplemented.

## Open queue and sequencing

| Ticket | Disposition | Scope |
| --- | --- | --- |
| CJ-09 | Conditional; narrowed | Quest listing reuse only, subject to a clear simplification with explicit public fields. |
| CJ-11 | Small deletion ready; broader work conditional | Remove the unused session include; narrow other encounter reads only when query ownership stays simple. |
| CJ-20 | Partially complete | Encounter, initiative, and turn actions use schemas; legacy combatant amount parsing remains. |
| CJ-21 | Conditional; narrowed | Share common map projection/parsing without private glossary enrichment; SVG reuse is optional. |

With CJ-05/06/07/08/10/12/22 complete, the unused session include in CJ-11 is the next straightforward deletion. CJ-20 needs deliberate characterization of the legacy amount coercion before implementation.

These priorities are not hard dependencies. CJ-09, broader CJ-11 query changes, and CJ-21 are not mandatory cleanup: defer them if the proposed implementation adds more machinery than it removes. CJ-11's unused session include can be deleted directly. Profiling can inform broader query-work priority, but is not required to establish that a query loads unused relations.

## Execution and completion protocol

1. Read the selected ticket and current source; check all callers, Nuxt auto-import surfaces, and existing tests. Preserve unrelated working-tree changes.
2. Establish current contracts before changing behavior. Implement the smallest concrete deletion/reuse; do not expand into neighboring tickets without a reason tied to the goal.
3. After JavaScript/TypeScript/Vue changes, pass `yarn lint`, `yarn typecheck`, and relevant tests. Extend a few comprehensive workflow/contract tests rather than turning each acceptance item into a separate test. Pure unreachable-code deletions do not need invented behavior tests. Run the integrated `yarn test` for a completed multi-area batch.
4. Match browser checks to the affected behavior: keyboard navigation, direct URLs, Back/Forward, dirty guards, and failure recovery where applicable. Cover desktop/mobile controls when both are affected; check light/dark themes when presentation changes warrant it. A build is not browser verification.
5. Use one final production `yarn build` for an agreed implementation batch, or for a standalone change when packaging/rendering risk warrants it; do not rebuild after every small ticket. Allow approximately 8 minutes and wait for actual exit status through quiet Nitro packaging; do not mistake an early tool yield for a hang or completion.
6. Coordinate a single API test runner: suites share port 4181. Poll yielded command sessions to completion. Do not run competing API launchers or treat a cross-server result as a valid test verdict.
7. Review the final diff against acceptance criteria, correct gaps, and record actual checks, limitations, and commit when committed. Commit or merge according to the current user instruction; no historical per-ticket branch workflow is required. Rollback is a code revert.

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

## Outside the current scope

- Generic public/private unification for glossary, milestones, or journal. Distinct queries and visibility rules require their own justification.
- Removing encounter read endpoints merely to reduce route count. Schema cleanup in CJ-20 does not authorize this.
- Removing storage interfaces/factories or the Prisma generated-client boundary because they are thin.
- Replacing session ownership, retained resources, editor drafts, confirmation components, or global player state with generic frameworks.
- Broad page/component splitting, theme redesign, and unrelated cleanup. Revisit only with a concrete problem and bounded benefit.
