# Project documentation

DND Campaign (DM Vault) organizes tabletop campaigns and their sessions,
characters, journal, glossary, quests, milestones, encounters, encounter maps, maps,
and calendars. Session workflows connect recordings, transcripts, versioned
documents, summaries, suggestions, and recap playback. Campaign membership
controls private access; enabled public sections expose selected campaign
content through public pages.

The feature and operations guides below describe the implemented application.
Feature proposals and implementation records live in
[development planning](planning/README.md); contributor conventions
and agent instructions live in [AGENTS.md](../AGENTS.md) and
[CLAUDE.md](../CLAUDE.md). Frontend component contracts and visual identity are in
[the style guide](StyleGuide.md).

## System structure

The Nuxt 4 application serves both the Vue interface and Nitro server routes.
Pages, components, layouts, and composable state live in `app/`. API handlers in
`server/api/` validate requests, authorize access, and shape responses; domain
behavior lives in `server/services/`. Shared schemas, types, and utilities live
in `shared/`.

Drizzle ORM with better-sqlite3 persists application data in SQLite. Local artifact storage holds files
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
| [Transcription](Transcription.md) | Scribe V3 recording transcription, glossary keyterms, language hints, number formatting, and artifacts. |
| [Characters](Characters.md) | Sheet data, derived summaries, section saves, failure recovery, and D&D Beyond imports. |
| [Encounters](EncounterWorkflow.md) | Participants, phases, initiative, effects, encounter exhaustion and long rests, and API/MCP operations. |
| [Encounter maps](EncounterMaps.md) | Generated dungeons, buildings, forests, floor-aware editing, regeneration and snapshot consequences, portable exports, canonical URLs and OpenAPI names, and compatibility boundaries. |
| [Maps](Maps.md) | GeoJSON and SVG rendering, selection, glossary filtering, and browser requirements. |
| [Installation and mobile playback](PWA.md) | PWA installation, private-data cache boundaries, safe updates, offline feedback, and real-device playback checks. |

## Integrations and operations

| Topic | Explanation |
| --- | --- |
| [Agent integration](AgentIntegration.md) | MCP connection, scoped API keys, tools, and API permissions. |
| [Deployment and recovery](DeploymentRecovery.md) | Container startup, authentication secret, Drizzle migrations, legacy database adoption, backups, and recovery. |
| [Project setup](../README.md) | Node.js and pinned pnpm setup, installation, environment, local development, and test commands. |
| [HTTP API](../public/openapi.json) | Resource paths, request/response schemas, and authentication. |
