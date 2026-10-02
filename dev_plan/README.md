# Development scratchpad

`dev_plan/` holds feature proposals, implementation plans and checklists,
investigations, experiments, progress notes, and working reference material.
Related notes can share a feature folder. Plans describe work in progress and
intended changes; implemented system behavior is documented in
[docs/](../docs/README.md).

Markdown planning notes are versioned. Other scratch assets stay local and
Git-ignored, including the existing Donjon tools and Chronosia map exports.
Coding and agent guidance lives in [AGENTS.md](../AGENTS.md) and
[CLAUDE.md](../CLAUDE.md).

## Current planning

- [Follow-ups](FollowUps.md): remaining feature scope, optional ideas,
  verification gaps, and build experiments.
- [Code simplification plan](CodeSimplificationPlan.md): the open refactor queue
  and its completion history.

## Implementation history and references

- [Encounter implementation record](EncounterImplementationPlan.md): completed
  tasks and recorded validation; current behavior is in
  [EncounterWorkflow.md](../docs/EncounterWorkflow.md).
- [MapLibre upgrade record](MapLibre6Upgrade.md): migration decisions and
  recorded validation; current rendering is explained in [Maps.md](../docs/Maps.md).
- [Planning history](PlanningHistory.md): recovery archives from the cleanup and
  the preserved local [Donjon tools](tools/donjon/) and
  [Chronosia exports](mapping/).
