# Application documentation

DND Campaign (DM Vault) organizes tabletop campaigns and their sessions,
characters, journal, glossary, quests, milestones, encounters, dungeons, maps,
and calendars. Session workflows connect recordings, transcripts, versioned
documents, summaries, suggestions, and recap playback. Campaign membership
controls private access; enabled public sections expose selected campaign
content through public pages.

These documents describe the implemented application and its operations.
Feature proposals and implementation records live in
[the development scratchpad](../dev_plan/README.md); contributor conventions
and agent instructions live in [AGENTS.md](../AGENTS.md) and
[CLAUDE.md](../CLAUDE.md).

## System structure

The Nuxt 4 application serves both the Vue interface and Nitro server routes.
Pages, components, layouts, and composable state live in `app/`. API handlers in
`server/api/` validate requests, authorize access, and shape responses; domain
behavior lives in `server/services/`. Shared schemas, types, and utilities live
in `shared/`.

Prisma persists application data in SQLite. Local artifact storage holds files
separately from database records and build output. Recording and recap playback
uses HTTP range streaming. ElevenLabs handles transcription, while n8n workflows
return generated summary and suggestion results to the application.

API successes use a `data` envelope. Errors under `/api/` use
`{ data: null, error: { code, message, fields } }`. The canonical route and
payload reference is [OpenAPI](../public/openapi.json).

## Features and state

| Topic | Explanation |
| --- | --- |
| [Session workspace](SessionWorkspaceOwnership.md) | Route ownership, drafts, job selection, navigation, and playback lifetimes. |
| [Session jobs](SessionJobs.md) | Summary/suggestion sources, n8n callbacks, review, and application of generated results. |
| [Characters](Characters.md) | Sheet data, derived summaries, manual edits, and D&D Beyond section imports. |
| [Encounters](EncounterWorkflow.md) | Participants, phases, initiative, effects, and API/MCP operations. |
| [Maps](Maps.md) | GeoJSON and SVG rendering, selection, glossary filtering, and browser requirements. |

## Integrations and operations

| Topic | Explanation |
| --- | --- |
| [Agent integration](AgentIntegration.md) | MCP connection, scoped API keys, tools, and API permissions. |
| [Deployment and recovery](DeploymentRecovery.md) | Container startup, persistent storage, database migrations, and recovery. |
| [Project setup](../README.md) | Installation, environment, local development, and test commands. |
| [HTTP API](../public/openapi.json) | Resource paths, request/response schemas, and authentication. |
