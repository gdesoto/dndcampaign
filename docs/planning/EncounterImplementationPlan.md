# Encounter workspace implementation record

## Agreed behavior
One stable participant workspace with local selection independent from the active turn. Planned encounters permit preparation; Active permits turn progression and effects; Paused permits corrections without ticking; Completed/Abandoned preserve a read-only record until explicit Reopen (to Paused). All phase restrictions apply through the API, including MCP.

## Implementation
- [x] Show background refresh in a reserved spinner slot after the encounter name, with stable layout and retained drafts in every phase.
- [x] Shared phase/action policy, typed lifecycle actions, explicit errors, no metadata bypass.
- [x] Unified participant list and selected details; phase controls; History and Settings panels; source-aware add/edit forms, side selection, pending/validation and empty/error states.
- [x] Predictable MCP transition, participant and effect tools, batch adds/targets, current state and permitted actions in responses. Existing tools remain compatible where safe.
- [x] OpenAPI and workflow documentation, API/policy/MCP/UI regression tests.
- [x] Lint, typecheck, full tests, build, desktop/mobile browser checks.

## Participant control follow-up
- [x] Move initiative menu into Participants header; add clear-all with Undo.
- [x] Use an accessible add-user icon and tooltip.
- [x] Add stacked row move controls and individual roll/clear controls.
- [x] Fix condition editor schema construction so Add/Edit opens.
- [x] Expose targeted roll/clear through API and MCP; document the contract.
- [x] Verify updated controls and condition creation/editing in browser and automated checks.

## Verification
- `yarn lint` and `yarn typecheck` pass.
- `yarn test --maxWorkers=1 --testTimeout=20000`: 88 files, 417 tests pass. A single worker avoids shared SQLite contention.
- Encounter Playwright workflow passes in development, including phase changes, editing/allegiance, HP validation, independent selection, refresh spinner/layout stability, and desktop/mobile light/dark views.
- Production build passes with a process-local 8 GB Node heap allowance. Packaging is slow on this Windows host; a brief CPU profile showed filesystem/package resolution dominating the wait.
- Production browser smoke test is blocked before app startup: generated Prisma client `fileURLToPath(import.meta.url)` becomes `fileURLToPath(globalThis._importMeta_.url)` in Nitro output, with `file:///_entry.js`, which is invalid on Windows (`ERR_INVALID_FILE_URL_PATH`). Generated output and database bootstrap code were not patched to bypass it.

## Decisions
Reopen preserves state and enters Paused. Roll/set initiative is available in Planned, Active and Paused. Effects are available in Active and Paused; starting HP and conditions can be prepared before Start. Finished records disallow mutations other than explicit lifecycle reopening or deleting the encounter. Selection never changes the active turn. Rewind moves the turn pointer without pretending to undo HP or condition history.

### Participant control verification
- Lint and typecheck pass.
- 40 targeted API/MCP/schema/policy tests and 5 encounter component tests pass.
- Expanded Playwright workflow passes, including individual/group roll and clear, row movement, condition create/edit, and desktop/mobile light/dark views.
- The attempted full-suite run encountered cold-start timeouts and was stopped after outdated component fixtures failed; those fixtures were corrected and the targeted component suite passes. A temporary 180-second server startup allowance was used for targeted API checks and reverted afterward.
- Final production build was stopped at user request after client and SSR compilation passed; Nitro packaging had not finished.
