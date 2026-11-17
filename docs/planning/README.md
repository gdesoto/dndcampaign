# Development planning

`docs/planning/` holds feature proposals, implementation plans and checklists,
investigations, experiments, progress notes, and working reference material.
Related notes can share a feature folder. Plans describe work in progress and
intended changes; implemented system behavior is documented in
[the application guides](../README.md).

Markdown planning notes are versioned. Other scratch assets stay local and
Git-ignored, including the existing Donjon tools and Chronosia map exports.
Coding and agent guidance lives in [AGENTS.md](../../AGENTS.md) and
[CLAUDE.md](../../CLAUDE.md).

## Current planning

- [Follow-ups](FollowUps.md): remaining feature scope, optional ideas,
  verification gaps, and build experiments.
- [Code simplification plan](CodeSimplificationPlan.md): the open refactor queue
  and its completion history.

## Implementation history and references

- [Dependency major upgrades](DependencyMajorUpdates.md): compatibility decisions,
  cleanup, and validation for SQLite, hashing, dotenv, DOM tests, and TypeScript.
- [Prisma to Drizzle migration](DrizzleMigrationPlan.md): completed migration,
  validation evidence, and completed production rollout; runtime and recovery are in
  [DeploymentRecovery.md](../DeploymentRecovery.md).
- [Encounter implementation record](EncounterImplementationPlan.md): completed
  tasks and recorded validation; current behavior is in
  [EncounterWorkflow.md](../EncounterWorkflow.md).
- [MapLibre upgrade record](MapLibre6Upgrade.md): migration decisions and
  recorded validation; current rendering is explained in [Maps.md](../Maps.md).
- [Planning history](PlanningHistory.md): recovery archives from the cleanup and
  the preserved local [Donjon tools](tools/donjon/) and
  [Chronosia exports](mapping/).
- [PWA implementation and validation](PWA.md): module compatibility, cache and
  update decisions, automated evidence, and physical-device validation boundaries.
