# Milestone D Checklist (Documents + Version History)

Status legend: [ ] not started, [~] in progress, [x] done.

## 1) Database + Prisma
- [x] Add document models (documents, document_versions) with enums for type/format/source
- [x] Add relations for sessions/campaigns/recordings and currentVersion pointer
- [x] Add optional VTT artifact linkage on recordings
- [x] Run migration + generate client

## 2) Document service layer
- [x] Create DocumentService with create/update/version/restore helpers
- [x] Ensure version numbers auto-increment per document
- [x] Ensure ownership enforcement via routes

## 3) API routes
- [x] GET /api/documents/:documentId (document + currentVersion)
- [x] PATCH /api/documents/:documentId (create new version)
- [x] GET /api/documents/:documentId/versions
- [x] POST /api/documents/:documentId/restore
- [x] GET /api/sessions/:sessionId/documents (filter by type)
- [x] POST /api/sessions/:sessionId/documents (create transcript/summary)
- [x] POST /api/sessions/:sessionId/documents/import (import txt/md)
- [x] POST /api/recordings/:recordingId/vtt (attach subtitles)

## 4) UI (Session + Editor)
- [x] Session detail: transcript + summary panels (create, edit, open editor)
- [x] Session detail: import transcript/summary from file
- [x] Document editor page with version list + restore
- [x] Document editor: save creates new versions
- [x] Recording detail: attach and render VTT subtitles for video

## 5) Acceptance checks
- [x] Create transcript + summary for a session and edit them
- [x] Version history lists changes and restore works
- [x] Upload/import text file to seed a transcript
- [x] Video recording displays subtitles when VTT attached
- [x] App runs successfully after migration
