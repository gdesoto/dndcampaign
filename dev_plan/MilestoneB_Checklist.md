# Milestone B Checklist (Sessions + Glossary + Quests/Milestones)

Status legend: [ ] not started, [~] in progress, [x] done.

## 1) Database + Prisma
- [x] Add models: sessions, glossary_entries, glossary_session_links, quests, milestones
- [x] Add indexes/relations for campaign ownership and session linking
- [x] Run migration + generate client
- [x] Update seed data with sample sessions/glossary/quests/milestones (optional)

## 2) Shared schemas (Zod)
- [x] Glossary create/update schemas
- [x] Sessions create/update schemas
- [x] Quests create/update schemas
- [x] Milestones create/update schemas
- [x] Shared enums for glossary type + quest status

## 3) API routes (Nitro)
- [x] Sessions CRUD
  - [x] GET /api/campaigns/:campaignId/sessions
  - [x] POST /api/campaigns/:campaignId/sessions
  - [x] GET /api/sessions/:sessionId
  - [x] PATCH /api/sessions/:sessionId
- [x] Glossary CRUD + session tagging
  - [x] GET /api/campaigns/:campaignId/glossary
  - [x] POST /api/campaigns/:campaignId/glossary
  - [x] PATCH /api/glossary/:entryId
  - [x] DELETE /api/glossary/:entryId
  - [x] POST /api/glossary/:entryId/sessions/:sessionId
  - [x] DELETE /api/glossary/:entryId/sessions/:sessionId
- [x] Quests CRUD
  - [x] GET /api/campaigns/:campaignId/quests
  - [x] POST /api/campaigns/:campaignId/quests
  - [x] PATCH /api/quests/:questId
  - [x] DELETE /api/quests/:questId
- [x] Milestones CRUD
  - [x] GET /api/campaigns/:campaignId/milestones
  - [x] POST /api/campaigns/:campaignId/milestones
  - [x] PATCH /api/milestones/:milestoneId

## 4) UI pages
- [x] /campaigns/[campaignId]/sessions (list + create)
- [x] /campaigns/[campaignId]/sessions/[sessionId] (detail + edit)
- [x] /campaigns/[campaignId]/glossary (tabs by type + create/edit)
- [x] /campaigns/[campaignId]/quests (list + create/edit)
- [x] /campaigns/[campaignId]/milestones (list + create/edit)

## 5) UX essentials
- [x] Empty states for each list
- [x] Basic form validation errors
- [x] Link from campaign overview to each section

## 6) Acceptance checks
- [x] Create session and edit notes/title
- [x] Create glossary entry and link to a session
- [x] Create quest + milestone and update status/completion
- [x] All CRUD endpoints enforce campaign ownership
- [x] App runs successfully after migration
