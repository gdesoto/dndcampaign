# Code simplification investigation and implementation tickets

Date: 2026-09-11, revised 2026-09-13. Reviewed baseline: `71ff70a` (`Simplify API handler plumbing and remove dead code`) plus the uncommitted S1/S3/S4/S5 working tree described under "Completed" below. Line citations were refreshed on 2026-09-13; re-check them before editing.

This was a static, read-only investigation of application code. This plan is the only intended file change. No application changes, migrations, tests, or browser sessions were run. Findings are source-verified opportunities, not measured performance claims. Source line numbers refer to the reviewed baseline.

Five GPT-6 Astra reviewers used low reasoning for sessions, campaign/admin APIs, general frontend, gameplay, and a broad structural sweep. A sixth independent validation agent checked the proposals, callers, contracts, and simpler alternatives. The agent tool did not expose a standard-speed setting. The primary agent reconciled the reports and sampled the source. The sweep covered app/server/shared architecture; it does not claim exhaustive review of every line or knowledge of external API consumers.

## Instruction precedence and constraints

- Per the user's explicit instruction, **Nuxt UI Guidelines outranks the dmvault style-guide skill wherever they conflict**. Read `C:/Users/gdesoto/.codex/plugins/cache/dndcampaign/nuxt-ui-guidelines/0.1.0/skills/nuxt-ui-guidelines/SKILL.md` and its relevant references, plus repository `AGENTS.md`, `StyleGuide.md`, and `.codex/skills/dmvault-style-guide/SKILL.md`. If the cache moves, locate the installed plugin. Apply this precedence to all tickets; this audit does not authorize an unrelated visual redesign.
- Prefer deletion, existing services, native routing, and schema-derived types. Do not introduce generic CRUD, configurable query-loader, media, or state-management frameworks to implement these tickets.
- Preserve documented session ownership in `docs/SessionWorkspaceOwnership.md`: one parent instance, pinned IDs, watcher disposal, same-session drafts, dirty exit guards, combined jobs, historical-selection identity checks, exact-scope retained resources, and global playback lifetime.
- Preserve authorization, explicit public response boundaries, validation, error/retry handling, draft retention, conflicting-action guards, keyboard access, and focus behavior.
- Keep public URLs and payloads unless a ticket explicitly identifies a change. Update `public/openapi.json` for API behavior/contract changes. No ticket requires a database migration.

## Completed since the original review (uncommitted working tree, 2026-09-13)

These landed after the original sweep and outrank the per-feature tickets below because they removed shared plumbing rather than one feature's duplication. Each carries one deliberate behavior change.

- **S1 — Thrown errors and one Nitro error handler.** `ServiceResult`, `Validated`, `fail`, and `respond` are gone. Handlers, utils, and services throw `apiError(statusCode, code, message, fields?)`; `server/error-handler.ts` shapes anything thrown under `/api/` into the unchanged `{ data, error }` envelope. Behavior change: server messages and validation `fields` now reach the client through `useApi` (they never did before, because `$fetch` threw first), and a 404 thrown by a service now propagates through remapping catches instead of becoming a generic 400/500.
- **S3 — Handler-owned authorization.** Campaign-scoped handlers call `requireCampaignPermission` once and pass `access` or `actor` into services; calendar, journal, requests, dungeon, encounter, and map services no longer re-query membership, and no service threads `systemRole`. Behavior change: a VIEWER attempting a dungeon write receives 403 instead of 404, matching every other campaign route.
- **S4 — One multipart reader.** `server/utils/multipart.ts` replaced five Busboy state machines (recordings, recaps, captions, document import, map upload).
- **S5 — One caption converter.** `srtToVtt`, `normalizeVtt`, `isLikelySrt`, and `toVtt` live in `shared/utils/transcript.ts`.

## Managed implementation progress (2026-09-13)

The original investigation above is historical. This batch starts from clean `master` at `7ee3df7`; the earlier S1/S3/S4/S5 work is already committed. Execute one ticket at a time in the user-requested order below. Each ticket has a `codex/cj-NN` branch, Terra implementation and independent review, and a final manager review before a local merge to `master`. Implementation agents own scoped code and checks; the manager owns this log and Git operations. No database migrations are planned.

| Ticket | Status | Branch | Implementation commit | Validation and review |
| --- | --- | --- | --- | --- |
| CJ-13 | Complete; approved for merge | `codex/cj-13` | `2a6c78b` | Removed unused method/import in `server/services/encounter/encounter-runtime.service.ts` and two orphan types in `shared/types/encounter.ts` (54 lines). Tracked/hidden source searches found no callers; lint, typecheck, diff check passed. Independent Terra and manager reviews approved; no behavioral test needed for dead code. |
| CJ-14 | Pending | `codex/cj-14` | — | — |
| CJ-23 | Pending | `codex/cj-23` | — | — |
| CJ-15 | Pending | `codex/cj-15` | — | User confirmed detailed plan: remove `/api/account/profile`, retain `/api/auth/me` via account service. |
| CJ-16 | Pending | `codex/cj-16` | — | — |
| CJ-17 | Pending | `codex/cj-17` | — | — |
| CJ-02 | Pending | `codex/cj-02` | — | — |

Run the integrated full test suite, lint, typecheck, and production build after the final ticket. Record actual results and any limitations here. Ticket branches remain available for inspection; rollback is a code revert.

Validation prerequisite: initial CJ-13 lint failed because the bundled UI reference app moved to `.claude/skills/nuxt-ui-guidelines` while ESLint excluded only its old `.agents/plugins` location. Commit `4b2226d` adds the current path to `eslint.config.mjs`; independent review approved, and normal `yarn lint` then passed. No app source is excluded by this fix.

## Prioritized findings

Scary: **1** mechanical/local; **2** bounded behavior; **3** several flows or query/route ownership; **4** broad compatibility/data risk; **5** architectural migration. Bang for buck: **5** strongest benefit relative to effort, **1** weakest. These are engineering judgments, not measured scores. Effort: XS under half a day, S approximately half–one day, M approximately one–two days, including focused verification.

| Ticket | Issue and recommended option | Scary /5 | Bang /5 | Effort |
| --- | --- | ---: | ---: | --- |
| CJ-01 | Private streaming duplicates range handling; reuse `getMediaStream` | 2 | 5 | S |
| CJ-02 | Character imports duplicate the section enum; use schema options | 1 | 4 | XS |
| CJ-03 | Obsolete upload/read methods and duplicate artifact persistence; delete and delegate | 2 | 4 | S |
| CJ-04 | Request service mirrors Prisma types and identity conversions; derive and delete | 1 | 4 | S |
| CJ-05 | Transcript Create secretly has an editor path; make it creation-only | 2 | 4 | S |
| CJ-06 | Session navigation forwards events across layers; use native links | 2 | 4 | S |
| CJ-07 | Dungeon preview duplicates player-safe projection; share the existing pure function | 2 | 4 | S |
| CJ-08 | Quest card has unused configuration and duplicate group templates; simplify locally | 2 | 4 | S–M |
| CJ-09 | Public quests duplicate query/serialization; reuse with explicit public fields | 2 | 4 | S |
| CJ-10 | Campaign selector mirrors router state; derive selection from the route | 3 | 4 | S |
| CJ-11 | Encounter access lookup loads unused relations; narrow queries at actual consumers | 3 | 4 | M |
| CJ-12 | Cached/fresh playback repeats the same operation; converge locally | 2 | 3 | S |
| CJ-13 | Uncalled encounter runtime-board layer; delete method and orphan types | 1 | 3 | XS |
| CJ-14 | Unused client public-overview facade duplicates an active one; delete it | 1 | 3 | XS |
| CJ-15 | Duplicate profile logic; remove `/api/account/profile`, retain `/api/auth/me` via account service | 1 | 4 | XS |
| CJ-16 | Two copied transcription job DTO mappers already drifting; one mapper in the service | 1 | 4 | XS |
| CJ-17 | Dev n8n endpoint hand-validates a payload the Zod schema already covers; delete the shadow validator | 1 | 3 | XS |
| CJ-18 | Create-or-update document repeated in four places; add `DocumentService.upsertForSession` | 1 | 3 | XS |
| CJ-19 | Business logic still inside routes (glossary PC link, calendar month view, transcript apply, subtitle attach); move to services | 2 | 4 | S–M |
| CJ-20 | Encounter initiative and turn live in separate routes with hand-parsed actions; fold into `PATCH /encounters/:id` | 2 | 3 | S |
| CJ-21 | Public map viewer and SVG re-implement `MapService`; reuse after `resolvePublicAccess` (extends CJ-09) | 2 | 3 | S |
| CJ-22 | Playback-url routes return a constant path the client can build; delete both | 2 | 2 | XS |
| CJ-23 | `campaign.delete` permission has no users and no route; delete it | 1 | 2 | XS |

Start with CJ-15/16/17/23 (same-day deletions), then CJ-01/02/03/04 for direct reuse. CJ-04 and CJ-18 are cheaper than originally rated because S1/S3 removed the plumbing around them. CJ-13/14 are convenient isolated cleanup, not reasons to delay higher-value work. CJ-05/06/12 touch the same session area and should run sequentially. Implement CJ-13 before CJ-11 to reduce its caller set. CJ-09 and CJ-14 both concern public access but modify different layers; do not confuse their similarly named methods.

## Execution and completion protocol

Each ticket is independently assignable to a future agent. Re-read its affected files and search symbols before editing: the inventory below is accurate for this snapshot, not a promise about future commits. Preserve unrelated working-tree changes. Use one reviewable change per ticket; avoid opportunistic neighboring refactors.

1. Confirm the cited duplication and current callers, including Nuxt auto-import names and template components. Capture current contracts with existing tests or focused behavior coverage where needed.
2. Implement the smallest listed deletion/reuse. Avoid API changes unless explicitly planned. Review the diff for fewer branches/state owners/layers, not just moved lines.
3. Run `yarn typecheck` and `yarn lint`. Run relevant existing tests with `yarn test:unit`, `yarn test:api`, or `yarn test:nuxt` plus the indicated file path. Pure dead-code deletions do not need invented tests.
4. For UI behavior changes, run `yarn build` and inspect affected interactions at desktop/mobile widths and in light/dark themes per Nuxt UI Guidelines. Verify direct URLs, Back/Forward, guards, keyboard navigation, and failure recovery where relevant. A passing build is not browser verification.
5. For the integrated batch, run `yarn test`, `yarn typecheck`, `yarn lint`, and `yarn build` once after the final changes. Investigate failures without broad unrelated rewrites. Report actual checks and gaps.
6. Update affected architecture/API documentation and mark the ticket complete with changed paths, actual checks, remaining limitations, and the commit. Rollback is a code revert; there are no planned data migrations. CJ-01's range behavior and CJ-10's navigation change must be called out in review.

## CJ-01 — Reuse the existing media-range implementation

**Problem/evidence:** `server/api/artifacts/[artifactId]/stream.get.ts:17–50` hand-rolls range parsing and stream handling already provided by `server/utils/media-stream.ts:6`. Public recap streaming uses that utility with the same storage factory. The private implementation does not clamp oversized ends or consistently reject unsatisfiable ranges.

**Plan:** Keep `requireArtifactReadAccess`, MIME type, and URLs. Call `getMediaStream(adapter, storageKey, rangeHeader)`, apply its status/headers, and send its stream or empty response. Delete private range/full-stream branching. Do not move authorization into the generic helper.

**Affected inventory:** Edit the private artifact stream route and `public/openapi.json` artifact stream operation (around line 920). Reuse the media utility and storage interface. Regression paths include `server/services/campaign-public-access.service.ts`, `server/api/public/campaigns/[publicSlug]/recaps/[recapId]/stream.get.ts`, recording/recap playback URL handlers, `useSessionRecordings`, `useSessionRecap`, `useMediaPlayer`, recording and document detail pages' artifact links, and public recap playback. Consumer URLs remain unchanged.

**Acceptance/checks:** Cover full 200, partial/suffix 206, oversized-end clamping, invalid/unsatisfiable 416, denied access, and adapters without range support. Use `test/unit/media-stream.test.ts` and `test/api/api.recap-video.test.ts`; extend private-route coverage, currently only full-stream coverage. Record intentional deltas: anchored parsing treats malformed/multiple ranges as full 200; start beyond size, reversed ranges, zero suffix, and unsafe integers yield 416; unsupported adapters no longer falsely advertise ranges. Unsatisfiable ranges should `throw apiError(416, ...)` and let `server/error-handler.ts` produce the envelope. Document binary 200/206/416 responses and range headers in OpenAPI. Do not describe this as entirely behavior-preserving.

## CJ-02 — Use the character section schema as the registry

**Problem/evidence:** `server/services/character-import.service.ts:24–55` maintains a 29-line all-true object only to call `Object.keys`. `shared/schemas/character.ts:6–34` already defines the same sections and order.

**Plan:** Use `characterSectionSchema.options` for missing/empty section selections; delete the object and cast. Inline the single-use fallback if clearer. Optionally replace the duplicate union in `app/utils/character-import.ts:3–30` with the existing `CharacterSection` type; retain actual display labels.

**Affected inventory:** Import service `normalizeSections` → `applyImport` → `createFromImport`, `importIntoCharacter`, `refreshImport`; `server/api/characters/index.post.ts`, `server/api/characters/[characterId].patch.ts`; character index/detail pages and `app/components/characters/ImportModal.vue`. Shared schema and OpenAPI character contracts stay unchanged.

**Acceptance/checks:** Missing/empty selections preserve all sections and order; explicit subsets, locked sections, and FULL/SECTIONS behavior stay unchanged. Typecheck and focused fallback verification are sufficient for the small registry substitution. Existing character UI/RBAC coverage does not directly establish import fallback behavior. Do not turn this into a generic nested-path engine.

## CJ-03 — Delete obsolete upload paths and delegate buffer artifact creation

**Problem/evidence:** `RecordingService.createRecordingFromUpload` and `CreateRecordingInput` at `server/services/recording.service.ts:6–16,40–66` have zero repository callers. `ArtifactService.getStream` at `server/services/artifact.service.ts:68–73` also has zero callers. S4 already removed the handler-side Busboy code this ticket warned about touching, so the remaining work is two deletions plus the buffer-to-stream delegation (effort XS). Buffer and streaming artifact creation duplicate the same persistence block at lines 28–66.

**Plan:** Delete the dead recording method/type and artifact reader. Keep the used buffer convenience method, adapting `data` with `Readable.from([data])` into `createArtifactFromStream`. Use one metadata persistence implementation. Do not remove `StorageAdapter.putObject` or add another upload abstraction.

**Affected inventory:** Edit recording/artifact services. Buffer callers: `transcription.service.ts:435,467`; stream callers: `recording.service.ts:69,97` and `recap.service.ts:20`; active multipart entry: `server/api/sessions/[sessionId]/recordings.post.ts:123`. Map uploads still call adapter `putObject` (`map-upload.service.ts:267,796`). Storage interface/factory and local adapter remain.

**Acceptance/checks:** Repeat reference searches before deleting. Verify buffer/stream bytes, checksum, MIME, metadata, labels, storage keys, and failure behavior with focused service coverage; run recap API regression coverage. Preserve recording cleanup when recording-row creation fails. Artifact-row persistence failure does not currently have equivalent rollback: do not claim this ticket supplies it or broaden scope into cleanup redesign. Dead deletions alone are scary 1; stream delegation makes the combined ticket scary 2.

## CJ-04 — Derive request result types and remove no-op conversion layers

**Problem/evidence:** `server/services/campaign-requests.service.ts:35–63` manually mirrors a Prisma query result and adds identity `toStatus`; fifteen `as RequestWithRelations` casts remain. S3 already removed the access re-resolution and `systemRole` threading this ticket originally mentioned. `campaign-requests.helpers.ts:32–36` repeats an owner/pending predicate. The same hand-mirrored row types exist in `quest.service.ts` (`toQuestDto` parameter), `calendar-config.service.ts` (`CampaignCalendarConfigRow`), and `campaign-public-access.service.ts` (`CampaignPublicAccessRecord`); apply the same fix there.

**Plan:** Define a typed literal query selection and derive its result via `Prisma.CampaignRequestGetPayload`, following `campaign-journal.service.ts:100`. Preserve literal inference; remove the casts, identity conversion, and redundant argument projections. A single named creator/pending predicate may serve edit/cancel. Keep useful policy names; do not delete the helpers file solely because it has one production importer.

**Affected inventory:** Request service and optionally its helpers; every handler in `server/api/campaigns/[campaignId]/requests/` (list/create/detail/update/vote/unvote); `useCampaignRequests` and campaign requests page. `shared/types/campaign-requests.ts`, shared schemas, and OpenAPI remain compatible.

**Acceptance/checks:** No casts concealing query-shape mismatch; identical list/detail payloads and creator/private-visibility/DM/pending-vote/repeat-vote rules. Run `test/api/api.campaign-requests-routes.test.ts`, `test/unit/campaign-requests-rules.test.ts`, and `test/nuxt/campaign-requests-page.test.ts`. The unit file covers schema rules, not all helper authorization; do not treat it as sufficient alone.

## CJ-05 — Remove the transcript workspace's unused editing mode

**Problem/evidence:** `useSessionDocuments.ts:45` creates or PATCHes a transcript, but its only production caller is the Create event in the session `[step].vue:58`. `TranscriptPanel.vue:185` renders Create even with an existing transcript. Editing already has a document-editor link at line 84. `useSessionWorkspaceViewModel.ts:55,92,100,176` maintains a mirrored form/ref/watch with no transcript input. Clicking Create on an existing document can create a redundant version and force PLAINTEXT.

**Plan:** Make `createTranscript` create an empty document only when missing, and hide/disable that action when a document exists. Existing records use the existing editor link. Delete the PATCH branch, shadow transcript form/ref/watch, and `transcriptContent` option. Keep summary editing, errors, import/delete, and busy protection; guard duplicate/conflicting creation locally.

**Affected inventory:** `app/composables/useSessionDocuments.ts`, `useSessionWorkspaceViewModel.ts`, `app/components/session/TranscriptPanel.vue`, `app/pages/campaigns/[campaignId]/sessions/[sessionId]/[step].vue`; fixtures in `test/nuxt/session-delete-recovery.test.ts`; panel tests. Existing `server/api/sessions/[sessionId]/documents.post.ts:32` already returns 409 for duplicate creation; `document.service.ts:67` owns real versioning. No backend/schema/OpenAPI change. Clarify ownership documentation if needed.

**Acceptance/checks:** One empty POST when missing, no PATCH/create when present, error and retry, double-submit protection, editor link, and preserved import/delete recovery. Extend `test/nuxt/session-panels.test.ts`, run deletion recovery and session workspace route tests. Do not remove the real summary draft or document editor.

## CJ-06 — Replace session navigation event chains with native links

**Problem/evidence:** `StepLinkButton.vue:18` emits Open; `StatusCards.vue:76`, `RecordingsPanel.vue:70`, and `RecapPanel.vue:113` forward navigation through parents to `useSessionWorkspaceViewModel.ts:243`, which finally calls `navigateTo`. `WorkflowTimeline.vue:9` already uses native links. StatusCards' `mode`/`activeStep` props and timeline descriptions are unused.

**Plan:** Give the step button a destination and use native `to`; retain its useful tooltip/accessibility presentation. Pass destinations through callers. Delete routing-only `open`, `open-step`, `jump-step`, and `openSessionSection`, plus unused props/bindings/descriptions. Prefer existing native navigation item types where needed; no new router abstraction.

**Affected inventory:** `app/components/session/{StepLinkButton,StatusCards,RecordingsPanel,RecapPanel,WorkflowTimeline}.vue`; `useSessionWorkspaceViewModel.ts`; session overview `index.vue`; session parent `[sessionId].vue` if item shape changes; `[step].vue` wherever changed panel props apply. `docs/SessionWorkspaceOwnership.md` should describe the final navigation contract. No API changes.

**Acceptance/checks:** Actual hrefs and correct destinations, keyboard and new-tab navigation, same-session draft retention, guarded session exit, unchanged request/instance counts. Update `test/nuxt/session-panels.test.ts` to assert destinations rather than forwarded events and run `session-workspace-routes.test.ts`. Retain invalid-step URL correction and `defaultStep` fallback: those are not the duplicated event mechanism.

## CJ-07 — Share the existing player-safe dungeon projection

**Problem/evidence:** `server/services/dungeon/dungeon-map-utils.ts:22` has `toPlayerSafeMap`; dungeon detail page lines 248–264 duplicates room/corridor/door filtering but omits attached trap/encounter/treasure/dressing filtering.

**Plan:** Move the existing pure function into `shared/utils/dungeon-map.ts`; import it directly at all three consumers. Delete the client filtering body and old definition. Keep server-side authorization/filtering and existing player-safe semantics.

**Affected inventory:** Original map utility, `server/services/dungeon/dungeon.service.ts:21,76`, `dungeon-export.service.ts:12,204`, `app/pages/campaigns/[campaignId]/dungeons/[dungeonId].vue:248`, new shared utility. Downstream `app/components/dungeon/MapCanvas.vue:205–219` already skips markers whose rooms are absent: this is data-parity/maintenance work, **not a confirmed visible secret leak**. `shared/types/dungeon.ts` supplies the unchanged type; no API/migration/schema changes.

**Acceptance/checks:** Secret rooms, incident corridors/doors, attached entities, no mutation, and idempotence in focused pure-function tests; preview passes the same projected data. Run `test/nuxt/dungeons-pages.test.ts` and export coverage in `test/api/api.dungeon-routes.test.ts`. Do not redefine what counts as player-safe in this refactor.

## CJ-08 — Remove unused QuestCard configuration and duplicate rendering

**Problem/evidence:** `app/components/campaign/QuestCard.vue:40–51` receives numerous display callbacks from its one caller page. Two color callbacks are never used. `quests.vue:484,513` repeats full card wiring for two groups; enclosing nonempty checks make inner empty branches unreachable.

**Plan:** Delete unused `typeBadgeColor`/`trackBadgeColor` props, functions at page lines 145–151, and bindings. Use two small group descriptors and one section/card template; remove unreachable branches. Optionally centralize invariant quest labels in a plain presentation utility shared with the public page, letting the card consume invariant metadata directly. Do not add a configurable card framework. Keep calendar-sensitive expiration formatting as a real input because public/private behavior differs.

**Affected inventory:** QuestCard and `app/pages/campaigns/[campaignId]/quests.vue`; optional `app/pages/public/[publicSlug]/quests.vue` and one plain label utility. Preserve permissions, mutation handlers, schema, confirmations, and drafts. API contracts remain unchanged.

**Acceptance/checks:** Both groups, ordering, real empty versus filtered no-matches, reader actions, expiration labels, and create/edit flows. Run `test/nuxt/campaign-quests-page.test.ts` and `quest-form-schema.test.ts`, plus mobile/keyboard inspection. Share labels only if it removes net ceremony; dead props/template cleanup stands alone.

## CJ-09 — Reuse private listings behind an explicit public allowlist (quests first; see CJ-21 for maps)

**Problem/evidence:** `campaign-public-access.service.ts:751` (`getPublicQuests`) repeats the query and mapping in `quest.service.ts`. Glossary and milestones follow the same shape and should use the same allowlist pattern once quests prove it out. The current public DTO omits campaignId; the relation selection/order otherwise match.

**Plan:** Keep `resolvePublicAccess(publicSlug, 'quests')` and both routes. Reuse `QuestService.listCampaignQuests` after public authorization, with an **explicit public field allowlist**. Alternatively extract the common query and a public-safe base mapper reused by both DTOs if that removes more duplication cleanly. Do not use rest-omit campaignId: a future private field could then become public automatically. Compare final diff size before choosing; do not introduce a generic serializer framework.

**Affected inventory:** Public-access and quest services; public quests GET and campaign quests GET handlers; other QuestService create/update callers; `usePublicCampaign.ts:152–178`, public quests page; private quest page, campaign overview, and encounter detail consumers. `shared/schemas/quest.ts` and OpenAPI quest definitions (around 5844,9723,10069) remain the contract; no endpoint removal or payload expansion.

**Acceptance/checks:** Exact public keys, no campaignId/private fields, null/date/source-name handling, ordering, unavailable slug and disabled section behavior; unchanged private results. Run `test/api/api.user-management-um5-public-access.test.ts`, `api.quest-routes.test.ts`, and campaign quest UI regression tests. Validator reduced the initial bang rating because explicit boundary preservation is more work than deleting the duplicate mapper outright.

## CJ-10 — Make the router own campaign selection

**Problem/evidence:** `app/composables/useCampaignSelector.ts:32–65` mirrors the route in a selected-ID ref, three watches, and a mount gate. Selection can get ahead of a navigation cancelled by a dirty-editor guard. An empty list can trigger navigation indirectly.

**Plan:** Use route-derived selection with a writable computed or explicit update handler. Only user selection invokes the existing `resolveCampaignSelectorRoute` and router. Remove synchronization watches/mount gate. Deliberately stop navigating merely because a list becomes empty/loading/failed; let the route/page handle availability. Preserve an intelligible display for a route ID absent from the current list without claiming it is a different campaign.

**Affected inventory:** Selector composable; sole consumer `app/components/AppHeader.vue:63` with desktop/mobile bindings at 133/216. Existing route resolver stays. All campaign routes using the header, especially dirty editors, are behavioral consumers; docs/default headers hide the selector outside campaigns. No API change.

**Acceptance/checks:** Cancelled navigation shows the actual route selection; successful selection, Back/Forward, delayed/empty/error list results, same-target selection, and desktop/mobile synchronization. Preserve `test/unit/campaign-selector-route.test.ts`; add meaningful composable/navigation coverage and exercise campaign workspace/dirty-editor routing. No selector-state test currently proves these cases. Review explicitly that list emptiness no longer redirects; this is a deliberate behavior correction, not merely shorter syntax.

## CJ-11 — Stop encounter authorization from loading an entire workspace

**Problem/evidence:** `server/services/encounter/encounter-shared.ts:24–40` (`getEncounterWithAccess`) always includes combatants, full ordered event history, and session. Most mutations need encounter fields only. `encounter.service.ts:291,492` then queries combatants/events again; initiative operations separately query combatants too.

**Plan:** After CJ-13, make authorized lookup minimal while preserving the `buildCampaignWhereForPermission` scope (S3 kept this single scoped lookup for child-id routes; `ensureCampaignAccess` no longer exists). Explicitly load relations where detail, summary, or turn logic needs them. Remove redundant reads, not necessary post-write rereads. Avoid a loader with boolean modes or a generic query-building framework.

**Complete helper caller inventory:**

- `encounter.service.ts`: `getEncounter`, `listCombatants`, `createCombatant`, `updateCombatant`, `deleteCombatant`, `listEvents`, `createNoteEvent`.
- `encounter-runtime.service.ts`: `transitionStatus`, `rollInitiative`, `reorderInitiative`, `moveTurn`, `setActiveTurn`, `applyDamage`, `applyHeal`, `createCondition`, `updateCondition`, `deleteCondition`; `getRuntimeBoard` removed in CJ-13.
- `encounter-summary.service.ts`: `getSummary`. Detail/summary need events; detail also needs conditions. Turn movement/selection need combatants. Initiative already has explicit combatant reads. Confirm session fields actually needed at each remaining site before narrowing.
- API families under `server/api/encounters/[encounterId]`: detail, summary, status PATCH, initiative, turn, combatants/conditions, events and notes. Frontend: `useEncounterDetail`, `useEncounterRuntime`, encounter detail page. Response types, schemas, URLs, and OpenAPI remain unchanged.

**Acceptance/checks:** Same permissions, missing/denied results, ordering, initiative transitions, HP, conditions, notes, detail and summary. Run `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`, `test/unit/encounter-summary.test.ts`. Add focused query assertions that HP/condition operations do not fetch event history and list operations avoid duplicate reads. Do not assert a speedup without measurement; the source establishes unnecessary work, not its wall-clock cost.

## CJ-12 — Converge cached and fresh playback locally

**Problem/evidence:** `useSessionRecordings.ts:46–100` and `useSessionRecap.ts:59–103` each duplicate their `playSource` payload/call between cached and freshly fetched URLs.

**Plan:** Within each existing composable, resolve the cached-or-fetched URL and call the existing player once under common error handling. Capture recap identity before awaiting so URL and descriptor match. No shared generic media controller is needed.

**Affected inventory:** Edit only these two composables; sole direct production consumer `useSessionWorkspaceViewModel`; downstream session overview/step routes and RecordingsPanel/RecapPanel retain contracts. Preserve caches, per-record busy state, recap progress IDs, audio/video distinction, and drawer behavior. No API/schema changes.

**Acceptance/checks:** Cached/fresh and repeated playback, URL fetch rejection, player rejection/retry, audio/video kind changes and identity during awaits. Use `test/nuxt/session-recap-playback.test.ts` and `session-delete-recovery.test.ts`; add recording repeat-play/error coverage. Run after CJ-05/06 to avoid simultaneous edits in the same feature area.

## CJ-13 — Delete the unused encounter runtime-board layer

**Problem/evidence:** `encounter-runtime.service.ts:543` defines `getRuntimeBoard` with zero callers. `shared/types/encounter.ts:140–156` defines `InitiativeLaneItem` and `EncounterRuntimeBoard` exclusively for that method. The live page derives its board from encounter detail.

**Plan/inventory:** Delete the method, its import, and both exclusive types in those two files. No route, test, schema, or OpenAPI references were found. Keep the active detail/runtime services.

**Acceptance/checks:** Repeat whole-repository symbol searches, including tests and auto-import surfaces, then typecheck/lint. No new behavioral test for unreachable code. Complete before CJ-11.

## CJ-14 — Delete the unused client public-overview wrapper

**Problem/evidence:** `useCampaignPublicAccess.ts:51–69,75` duplicates the overview path/DTO of `usePublicCampaign.ts:23–41`, but its `getPublicOverview` member has no app/test consumer. Its only composable consumer, campaign settings, uses settings/update/regenerate only.

**Plan/inventory:** Delete only that client method and returned member from `app/composables/useCampaignPublicAccess.ts`. Preserve settings methods, active `usePublicCampaign`, `usePublicCampaignPageContext`, public pages, the server's same-named service method, and public endpoint.

**Acceptance/checks:** Repeat symbol/caller search and typecheck/lint; no new behavior test for the uncalled member. No API or documentation contract removal.

## CJ-15 — Delete duplicate profile endpoints

**Problem/evidence:** `server/api/account/index.get.ts` and `server/api/account/profile.get.ts` are byte-identical; `server/api/auth/me.get.ts` is a third profile read with its own inline Prisma select. The profile DTO mapping is also repeated in `account/index.patch.ts`.

**Plan:** Keep `GET /api/account`. Delete `profile.get.ts`; make `auth/me` delegate to the account service; put the profile DTO mapper in `account.service.ts`. Remove the dropped path from `public/openapi.json` and update the client callers.

**Acceptance/checks:** Grep app and tests for `/api/account/profile` and `/api/auth/me`; run `test/api/api.user-management-um1.test.ts` and `api.auth-campaign.test.ts`.

## CJ-16 — One transcription job DTO mapper

**Problem/evidence:** `server/api/recordings/[recordingId]/transcriptions.get.ts` and `server/api/transcriptions/[jobId].get.ts` each carry a 25-line mapper plus a private `parseJsonArray`; they already differ (one omits `tagAudioEvents`).

**Plan:** Add `toTranscriptionJobDto` to `transcription.service.ts` and call it from both routes. Use the superset of fields so the two responses stop drifting.

**Acceptance/checks:** Typecheck; `test/api/api.session-jobs.test.ts`. Note the added field on the detail endpoint in OpenAPI.

## CJ-17 — Delete the hand-written n8n validator

**Problem/evidence:** `server/api/dev/n8n-test.post.ts` holds about 90 lines of manual shape checks that shadow `n8nWebhookPayloadSchema`, which the same file already imports and runs behind a `useZod` flag.

**Plan:** Always validate with the Zod schema and report `error.issues`; delete `validateN8nResponse`, `validateSummaryContent`, `validateSuggestions`, `isRecord`, and the `useZod` option. Dev-only route.

## CJ-18 — `DocumentService.upsertForSession`

**Problem/evidence:** The `existing ? updateDocument : createDocument` block appears in `sessions/[sessionId]/documents/import.post.ts`, `transcriptions/[jobId].patch.ts`, `summary.service.ts`, and (as a 409 check) `documents.post.ts`.

**Plan:** One service method taking `(sessionId, type, input)`; callers pass `source` and title. Keep the create route's 409 behavior explicit.

## CJ-19 — Move remaining business logic out of routes

**Problem/evidence:** `campaigns/[campaignId]/glossary/index.post.ts` creates player characters and links them inline (duplicated in `dev/characters/migrate.post.ts`); `calendar/view/index.get.ts` holds the month-window and session-range math; `transcriptions/[jobId].patch.ts` contains the whole apply-transcript and attach-subtitle flows. CLAUDE.md requires thin handlers.

**Plan:** `CharacterSyncService.linkGlossaryPc`, `CalendarConfigService.getMonthView`, `TranscriptionService.applyTranscript` and `attachSubtitles`. Handlers keep validation and permission only.

**Acceptance/checks:** Existing calendar, glossary, and session-jobs API tests; no payload changes.

## CJ-20 — Fold encounter initiative and turn into the encounter PATCH

**Problem/evidence:** `encounters/[encounterId]/initiative/index.patch.ts` and `turn/index.patch.ts` hand-parse `action` strings; `index.patch.ts` already dispatches lifecycle actions; the journal patch shows the intended shape (one `z.discriminatedUnion('action', ...)` and a `switch`).

**Plan:** Extend the encounter patch union with `roll`, `reorder`, `advance`, `rewind`, `set-active`; delete the two routes; update `useEncounterRuntime` and OpenAPI. Replace the manual `Number(rawBody.amount)` checks on the combatant patch with the schema.

**Acceptance/checks:** `test/api/api.encounter-routes.test.ts`, `test/nuxt/encounter-detail-page.test.ts`.

## CJ-21 — Public map viewer reuses `MapService`

**Problem/evidence:** `campaign-public-access.service.ts:836` re-implements map viewer and SVG streaming from `map.service.ts`, including a second `parseMapCoordinates`.

**Plan:** After `resolvePublicAccess(publicSlug, 'maps')`, call `MapService.getViewer` and `getMapSvg` (permission-free after S3) and project through an explicit public allowlist, as in CJ-09. Delete the duplicate parser.

## CJ-22 — Delete the playback-url routes

**Problem/evidence:** `recaps/[recapId]/playback/url` and `recordings/[recordingId]/playback/url` return a constant `/api/artifacts/:artifactId/stream` with `expiresAt: null`; the client already has `artifactId`.

**Plan:** Build the URL in `useSessionRecordings` and `useSessionRecap`; delete both routes and their OpenAPI entries. Keep one client helper so signed URLs can be introduced later without touching callers.

## CJ-23 — Delete the unused `campaign.delete` permission

**Problem/evidence:** `server/utils/campaign-auth.ts` defines `campaign.delete` with no route or service using it; no campaign delete endpoint exists.

**Plan:** Remove the permission entry. If a delete endpoint is wanted later, add both together.

## Investigated but not recommended

- **Storage interface/factory and Prisma generated-client shim:** intentional architectural boundaries, including planned storage providers; thinness alone does not justify removal.
- **Session context, feature composables, retained data, editor drafts, confirmation wrappers:** enforce actual lifetime/recovery/accessibility behavior. Few callers are not evidence of useless abstraction. The separate problem is page size: twelve pages exceed 600 lines (documents 1827, characters 1319, dungeon detail 1135) while 18 composables have one caller each. Split the largest pages into components first; extract composables only when a second page needs them. Not ticketed here because it is UI work outside this API-focused plan.
- **Encounter summary/events/combatants GET endpoints:** retained for now, but the "unknown external consumers" argument is weak: the app is the only client and `public/openapi.json` is hand-maintained. Reduce duplicate service queries under CJ-11 and revisit consolidation under CJ-20.
- **Public journal/private journal unification:** distinct visibility and holder/discovery/archive fields make broad reuse riskier than the validated quest opportunity. No generic public/private repository layer is proposed.
- **Map barrels, domain-specific character sync, test-server lifecycle helpers:** no sufficiently strong net simplification established. Map reimport already reuses its create path where appropriate.
- **Theme/style overhaul:** user precedence is recorded, but this complexity investigation did not establish a scoped theme rewrite ticket.

## Independent validation decisions

All 14 listed tickets were accepted after source/caller checks, with narrowed scope where needed. Validation specifically rejected rest-spreading private quest DTOs into public output, calling the dungeon duplication a demonstrated visible leak, deleting useful request policy helpers wholesale, and describing range-helper reuse as behavior-neutral. It required OpenAPI correction for streaming and explicit acknowledgement of the campaign selector's empty-list behavior change. The original 14 tickets were validated before S1/S3/S4/S5 landed; CJ-15 through CJ-23 were added on 2026-09-13 from a second sweep and have not been through the same independent validation. The S1/S3/S4/S5 work passed `yarn typecheck`, `yarn lint`, and all three Vitest projects (82 unit, 133 nuxt, 74 api) at the time of writing.
