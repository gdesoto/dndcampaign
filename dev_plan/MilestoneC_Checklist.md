# Milestone C Checklist (Recordings + Storage Abstraction)

Status legend: [ ] not started, [~] in progress, [x] done.

## 1) Database + Prisma
- [x] Add `artifacts` table for stored files (provider, storageKey, mimeType, byteSize, checksum, meta)
- [x] Add `recordings` table linked to sessions + artifacts
- [x] Add indexes on `sessionId` and `artifactId`
- [x] Run migration + generate client

## 2) Storage abstraction (local)
- [x] Define StorageAdapter interface
- [x] Implement local adapter (put/get/delete/exists/signedUrl)
- [x] Add storage factory with provider selection
- [x] Add ArtifactService: create metadata + stream

## 3) Recording service
- [x] Validate mime type (audio/video) and size
- [x] Store bytes via StorageAdapter
- [x] Create artifact + recording rows
- [x] Extract duration placeholder (optional)

## 4) API routes
- [x] POST /api/sessions/:sessionId/recordings (multipart upload)
- [x] GET /api/sessions/:sessionId/recordings (list)
- [x] GET /api/recordings/:recordingId/playback-url
- [x] GET /api/artifacts/:artifactId/stream
- [x] GET /api/artifacts/:artifactId (metadata, optional)

## 5) UI
- [x] Session detail page: recordings panel with upload + list + playback
- [x] Recording detail page: playback + metadata (basic)
- [x] Empty states + upload progress indicator (basic)

## 6) Acceptance checks
- [x] Upload audio/video recording and see it listed
- [x] Playback works via stream endpoint
- [x] Switching provider to local storage works without code changes
- [x] App runs successfully after migration

