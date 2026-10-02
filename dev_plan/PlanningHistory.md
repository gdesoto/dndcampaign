# Planning history

Cleaned up on 2026-10-02. Current purpose, setup, and documentation links live in
[README.md](../README.md); current implementation guidance lives in
[AGENTS.md](../AGENTS.md). The remaining backlog and optional ideas are in
[FollowUps.md](FollowUps.md), with deployment checks and recovery in
[DeploymentRecovery.md](../docs/DeploymentRecovery.md).

## Archived records

109 stale or completed planning files were removed from `dev_plan/` after their
archive entries were verified by byte length and SHA-256. The ZIPs preserve
original project-relative paths. They retain old requirements, checklists,
command results, sample payloads, and mockups for historical reference; their
routes, architecture, and status claims may be obsolete.

| Local archive | Original files | Contents |
| --- | ---: | --- |
| [foundations.zip](../storage/planning-history-2026-10-02/foundations.zip) | 5 | Original build/design blueprints, superseded encounter workspace plan, and two unrelated visual mockups. |
| [feature-history.zip](../storage/planning-history-2026-10-02/feature-history.zip) | 58 | Initial milestones, user management, journal, DM requests, endpoint migration, map import, and calendar records. |
| [technical-plans.zip](../storage/planning-history-2026-10-02/technical-plans.zip) | 26 | Prisma upgrade, build optimization, character imports, dungeon/encounter plans, summary/suggestion plans, and provider/sample payload notes. |
| [ui-planning-history.zip](../storage/planning-history-2026-10-02/ui-planning-history.zip) | 20 | UI refresh, audits, component/data/navigation plans, and transcript editor records. |

Archives are local and Git-ignored under `storage/planning-history-2026-10-02/`;
they are not included in a fresh clone. To inspect old content, extract a ZIP
into a separate folder. Restoring historical plans does not make them current
agent instructions.

## Preserved local references

- [Donjon tools](tools/donjon/): the Perl dungeon generator, three
  JavaScript references, and related name-generator HTML. All five are preserved.
- [Chronosia exports](mapping/): the SVG map, full JSON, and Cells,
  Markers, Rivers, and Routes GeoJSON exports. All six are preserved.

These 11 reference files survived the cleanup. Their assets remain Git-ignored
and are not deployment or automated-test inputs. Their original locations and
contents were preserved; `dev_plan/` also holds current planning notes.

## Current sources that supersede old plans

- [OpenAPI](../public/openapi.json) and `shared/schemas/`: current API contracts;
  the duplicate archived endpoint snapshots are obsolete.
- [SessionWorkspaceOwnership.md](../docs/SessionWorkspaceOwnership.md): session state
  and navigation lifetimes.
- [AgentIntegration.md](../docs/AgentIntegration.md) and
  [EncounterWorkflow.md](../docs/EncounterWorkflow.md): current agent and encounter
  behavior; [EncounterImplementationPlan.md](EncounterImplementationPlan.md) records the
  completed workspace change.
- [StyleGuide.md](../StyleGuide.md), the Nuxt UI guidelines referenced by
  `AGENTS.md`, `app/app.config.ts`, and `app/assets/css/main.css`: current UI
  conventions and theme contracts.
- `shared/schemas/dungeon.ts`, `shared/types/dungeon.ts`, and
  `server/services/dungeon/`: current dungeon behavior. Completed dungeon
  milestones are historical records, not missing feature lists.
