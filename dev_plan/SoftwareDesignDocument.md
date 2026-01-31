## **1\) Purpose and scope**

### **What this app does**

A web app for managing a Dungeons & Dragons campaign with:

* Campaign tracking (glossary of PCs/NPCs/items/locations, session tagging, quests/milestones/status)

* Session tracking (recordings, transcription via ElevenLabs, summaries via n8n, editable documents with version history)

* Configurable storage for recordings/transcripts/summaries (local, S3-compatible, Google Drive, database where appropriate)

### **Core user stories**

1. As a DM, I create campaigns and manage content (glossary, quests, milestones).

2. As a DM, I create sessions, upload recordings, start transcription, and review results.

3. As a DM, I can edit transcripts and summaries with version history \+ restore.

4. As a DM, I can play audio/video, with subtitles from VTT when available.

5. As a DM, I can send a transcript to an n8n webhook and store the returned summary.

---

## **2\) Architecture overview**

### **High-level**

* **Frontend**: Nuxt 4 app (SSR optional; default SSR enabled for fast page loads)

* **UI**: Nuxt UI 4 components \+ centralized styling via `app.config.ts` UI overrides

* **Backend**: Nuxt server routes (Nitro) under `/api/*`

* **DB**: SQLite via Prisma ORM

* **Background jobs**: Optional but strongly recommended (BullMQ \+ Redis) for transcription fetch, large uploads, webhook fanout

* **Storage abstraction**: `StorageAdapter` interface for recordings and document artifacts

* **Integrations**:

  * ElevenLabs transcription (async job \+ webhook callback)

  * n8n webhook for summarization (push transcript; receive summary)

### **Key design principles**

* Treat media \+ documents as **artifacts** with **storage keys** and **metadata** (provider-agnostic).

* Treat transcript and summary as **editable documents** with **versioned revisions**.

* Make all external callbacks **idempotent** (webhooks can repeat).

---

## **3\) Roles, permissions, and tenancy**

### **Roles**

* **Owner**: full control of a campaign.

* **Collaborator (optional phase 2\)**: read/write.

* **Viewer (optional phase 2\)**: read-only.

### **Tenancy model**

* Every object belongs to a `userId` and usually a `campaignId`.

* Enforce on every API endpoint: user must own campaign (or have access).

---

## **4\) Information architecture (pages, routes, UI)**

### **Layout**

* **Authenticated layout**: left sidebar \+ top bar

  * Sidebar: Campaign switcher, Overview, Glossary, Quests, Milestones, Sessions, Settings

  * Top bar: Search, “New session”, profile menu

### **Routes (Nuxt pages)**

1. `/login` (and `/register` if self-serve)

2. `/` → redirect to `/campaigns`

3. `/campaigns`

   * list campaigns

   * create campaign modal

4. `/campaigns/:campaignId`

   * default tab: Overview

5. `/campaigns/:campaignId/glossary`

   * tabs: PCs, NPCs, Items, Locations (same component, filtered by type)

6. `/campaigns/:campaignId/quests`

7. `/campaigns/:campaignId/milestones`

8. `/campaigns/:campaignId/sessions`

   * list sessions, status badges (has recordings/transcripts/summaries)

9. `/campaigns/:campaignId/sessions/:sessionId`

   * session detail: notes, tags, recordings list, transcript \+ summary

10. `/campaigns/:campaignId/sessions/:sessionId/recordings/:recordingId`

* playback \+ transcription status \+ actions

11. `/campaigns/:campaignId/documents/:documentId`

* editor \+ version history (used for transcript and summary)

12. `/settings`

* account \+ integrations defaults

13. `/campaigns/:campaignId/settings`

* per-campaign storage selection \+ webhook URLs \+ ElevenLabs settings override

### **UX patterns**

* **Global quick search**: search across glossary \+ quests \+ locations \+ sessions.

* **Tagging**: session tagging for glossary entries (many-to-many)

* **Status chips**: quest status, milestone completion, transcription status

* **Empty states**: friendly call-to-action (“Upload your first recording”)

* **Autosave** in editor: saves draft versions (debounced)

---

## **5\) Nuxt UI 4 usage and styling strategy**

### **Approach**

Use Nuxt UI components heavily, but avoid “class soup” by:

* defining **app-wide component defaults** in `app.config.ts`

* using a small set of **semantic wrapper components** (e.g., `AppPage`, `AppSection`, `AppEmptyState`, `AppToolbar`)

### **`app.config.ts` (conceptual)**

* Button: consistent radii, variants, loading spinner style

* Card: unified padding \+ header typography

* Table: dense mode defaults \+ sticky header option

* Form inputs: consistent sizes, focus rings

* Badge: status palette mapping (success/warn/error/info)

* Modal/drawer: consistent widths for “edit entity” flows

*(Implementation should mirror Nuxt UI 4’s override mechanism; confirm exact keys in docs.)*

---

## **6\) Core domain model**

### **Entities**

* **Campaign**

* **GlossaryEntry** (typed: PC/NPC/Item/Location)

* **Quest**

* **Milestone**

* **Session**

* **Recording** (audio/video file \+ metadata)

* **TranscriptionJob** (ElevenLabs async job tracking)

* **Document** (transcript or summary, editable)

* **DocumentVersion** (immutable revisions)

* **Artifact** (stored file reference: media, vtt, pdf, etc.)

* **Tag** (for sessions and entries; optional but helpful)

### **Concepts**

* “Transcript” is a **Document** that may also have **Artifacts** in multiple formats (txt, docx, vtt, pdf).

* “Summary” is a **Document** created from transcript (via n8n) and versioned.

---

## **7\) Database schema (Sqlite \+ Prisma recommended)**

Below is a concrete schema outline (field-level descriptions included). Types are conceptual.

### **`users`**

* `id` (uuid, pk)

* `email` (unique)

* `passwordHash` (nullable if OAuth)

* `name` (string)

* `createdAt`, `updatedAt`

### **`campaigns`**

* `id` (uuid, pk)

* `ownerId` (fk users.id)

* `name` (string)

* `system` (string, default “D\&D 5e”; extensible)

* `description` (text)

* `currentStatus` (text) — “Where we left off…”

* `createdAt`, `updatedAt`

### **`sessions`**

* `id` (uuid, pk)

* `campaignId` (fk)

* `title` (string) — “Session 12: The Glass Crypt”

* `sessionNumber` (int, nullable)

* `playedAt` (datetime, nullable)

* `notes` (text, nullable)

* `createdAt`, `updatedAt`

### **`glossary_entries`**

* `id` (uuid, pk)

* `campaignId` (fk)

* `type` (enum: `PC|NPC|ITEM|LOCATION`)

* `name` (string)

* `aliases` (text\[\], nullable)

* `description` (text)

* `visibility` (enum: `PRIVATE|SHARED` if collab later)

* `createdAt`, `updatedAt`

### **`quests`**

* `id` (uuid, pk)

* `campaignId` (fk)

* `title` (string)

* `description` (text)

* `status` (enum: `ACTIVE|COMPLETED|FAILED|ON_HOLD`)

* `progressNotes` (text, nullable)

* `sortOrder` (int, default 0\)

* `createdAt`, `updatedAt`

### **`milestones`**

* `id` (uuid, pk)

* `campaignId` (fk)

* `title` (string)

* `description` (text, nullable)

* `isComplete` (boolean, default false)

* `completedAt` (datetime, nullable)

* `createdAt`, `updatedAt`

### **`recordings`**

* `id` (uuid, pk)

* `sessionId` (fk)

* `kind` (enum: `AUDIO|VIDEO`)

* `filename` (string)

* `mimeType` (string)

* `byteSize` (bigint)

* `durationSeconds` (int, nullable)

* `artifactId` (fk artifacts.id) — where the media lives

* `createdAt`, `updatedAt`

### **`transcription_jobs`**

* `id` (uuid, pk)

* `recordingId` (fk)

* `provider` (enum: `ELEVENLABS`)

* `externalJobId` (string, unique) — transcript ID from ElevenLabs

* `status` (enum: `QUEUED|PROCESSING|COMPLETED|FAILED`)

* `requestedFormats` (text\[\]) — `["txt","docx","vtt","pdf"]`

* `errorMessage` (text, nullable)

* `completedAt` (datetime, nullable)

* `createdAt`, `updatedAt`

### **`documents`**

* `id` (uuid, pk)

* `campaignId` (fk)

* `sessionId` (fk, nullable)

* `recordingId` (fk, nullable)

* `type` (enum: `TRANSCRIPT|SUMMARY|NOTES`)

* `title` (string)

* `currentVersionId` (fk document\_versions.id)

* `createdAt`, `updatedAt`

### **`document_versions`**

* `id` (uuid, pk)

* `documentId` (fk)

* `versionNumber` (int) — incrementing

* `content` (text) — canonical editable content (Markdown recommended)

* `format` (enum: `MARKDOWN|PLAINTEXT`) — choose one canonical

* `source` (enum: `USER_EDIT|ELEVENLABS_IMPORT|N8N_IMPORT|SYSTEM_AUTOSAVE`)

* `createdByUserId` (fk users.id, nullable for system)

* `createdAt`

### **`artifacts`**

* `id` (uuid, pk)

* `ownerId` (fk users.id) — who owns this artifact

* `campaignId` (fk, nullable)

* `provider` (enum: `LOCAL|S3|GDRIVE|DB`)

* `storageKey` (string) — provider-specific path/object key/fileId

* `mimeType` (string)

* `byteSize` (bigint)

* `checksumSha256` (string, nullable)

* `label` (string, nullable) — “Transcript VTT”

* `meta` (jsonb, nullable) — provider-specific metadata

* `createdAt`

### **Link tables**

* `session_tags`: `id`, `campaignId`, `name`

* `session_tag_links`: `sessionId`, `tagId`

* `glossary_session_links`: `glossaryEntryId`, `sessionId` (for session tagging requirement)

### **Transcript artifacts mapping**

* `transcription_artifacts`: `transcriptionJobId`, `artifactId`, `format` (enum: `TXT|DOCX|VTT|PDF`)

### **Summary linkage**

* Summary document references transcript document via `meta` (json) or explicit field:

  * Option A: `documents.sourceDocumentId` nullable fk to documents

  * Preferred: add `sourceDocumentId` (fk) to `documents` for traceability.

---

## **8\) Storage subsystem (pluggable)**

### **Goal**

Support multiple storage backends without rewriting business logic.

### **`StorageAdapter` interface**

* `putObject(key, stream, meta) -> { storageKey, byteSize, checksum }`

* `getObject(storageKey) -> stream`

* `getSignedUrl(storageKey, { expiresInSeconds }) -> url` (if supported)

* `deleteObject(storageKey)`

* `exists(storageKey)`

### **Providers**

1. **Local filesystem**

   * Base path configurable: `STORAGE_LOCAL_ROOT`

   * Use signed URLs via app endpoint (stream proxy) or static serving behind auth

2. **S3-compatible**

   * Config: endpoint, region, bucket, accessKey, secret

   * Presigned URLs for upload/download recommended

3. **Google Drive**

   * Store `fileId` in `storageKey`

   * Use service account or OAuth per user (phase 2\)

4. **Database**

   * Only for small text artifacts (avoid storing large media in DB)

   * For DB artifacts, store bytes in `artifact_blobs` table (optional)

### **Configuration resolution**

* Global default in runtime config

* Per-user override (settings)

* Per-campaign override (campaign settings)  
   Resolution order: **campaign → user → global**

---

## **9\) ElevenLabs transcription integration**

### **Flow**

1. User uploads a recording.

2. User clicks “Transcribe” and selects formats (txt/docx/vtt/pdf).

3. Server sends recording to ElevenLabs transcription API.

4. ElevenLabs returns `externalJobId` immediately.

5. App tracks job as `PROCESSING`.

6. When complete, ElevenLabs calls our webhook endpoint.

7. App fetches transcript outputs, stores them as artifacts, and creates/updates the **Transcript Document**.

### **Webhook requirements**

* Endpoint: `POST /api/webhooks/elevenlabs/transcription`

* Must be **idempotent**:

  * If `externalJobId` already processed as completed, return 200 OK.

* Verify authenticity:

  * If ElevenLabs supports signature headers, validate with shared secret.

  * If not, require a secret query param or header token configured in app settings.

### **Failure handling**

* If webhook arrives but artifact fetch fails, mark job `FAILED` with retry-able error.

* Optional job queue: retry fetch N times with exponential backoff.

---

## **10\) n8n summarization integration**

### **Flow**

1. User clicks “Send to n8n for summarization” on a transcript.

2. Server POSTs to configured n8n webhook:

   * payload: campaign/session info \+ transcript content \+ optional instructions

3. n8n returns summary content (sync) **or** an async job id \+ callback URL (support both).

4. App creates/updates **Summary Document** and versions it.

### **Endpoint(s)**

* `POST /api/documents/:documentId/summarize`

* Optional callback: `POST /api/webhooks/n8n/summary` (if n8n async)

### **Payload contract (recommended)**

Send:

* `campaignId`, `sessionId`, `documentId`

* `transcriptContent` (canonical markdown/plaintext)

* `promptProfile` (optional): “bullet summary \+ key NPCs \+ loot \+ next hooks”  
   Receive:

* `summaryContent` (string)

* `meta` (json): tokens, model, timings (if provided)

---

## **11\) Editing \+ version tracking**

### **Canonical content format**

* Store editable text as **Markdown** (`documents` \+ `document_versions.content`).

* Derived artifacts (pdf/docx/vtt) are stored as `artifacts`.

### **Version creation rules**

* Import from ElevenLabs → version with `source=ELEVENLABS_IMPORT`

* User edits → version with `source=USER_EDIT`

* Autosave drafts (optional) → `SYSTEM_AUTOSAVE` (can be cleaned up)

### **Version UI**

* Right panel: version list with timestamps \+ source

* Diff view (phase 2): show changes between versions

* Restore button: sets `documents.currentVersionId = selectedVersionId`

---

## **12\) Media playback \+ VTT subtitles**

### **Playback component**

* Use native HTML5 `<audio>` / `<video controls>`

* For video, attach `<track kind="subtitles" src="...vttUrl" default>`

### **Serving media securely**

* Preferred:

  * S3: presigned URLs

  * Local: `GET /api/artifacts/:id/stream` streams bytes with auth

* VTT: same method; ensure correct `Content-Type: text/vtt`

---

## **13\) API design (Nitro server routes)**

All endpoints require auth (except webhooks with shared secret).

### **Campaigns**

* `GET /api/campaigns`

* `POST /api/campaigns`

* `GET /api/campaigns/:campaignId`

* `PATCH /api/campaigns/:campaignId`

* `DELETE /api/campaigns/:campaignId`

### **Glossary**

* `GET /api/campaigns/:campaignId/glossary?type=PC|NPC|ITEM|LOCATION&search=...`

* `POST /api/campaigns/:campaignId/glossary`

* `GET /api/glossary/:entryId`

* `PATCH /api/glossary/:entryId`

* `DELETE /api/glossary/:entryId`

* Session tagging:

  * `POST /api/glossary/:entryId/sessions/:sessionId`

  * `DELETE /api/glossary/:entryId/sessions/:sessionId`

### **Quests / milestones**

* `GET/POST/PATCH/DELETE /api/campaigns/:campaignId/quests...`

* `GET/POST/PATCH/DELETE /api/campaigns/:campaignId/milestones...`

### **Sessions**

* `GET /api/campaigns/:campaignId/sessions`

* `POST /api/campaigns/:campaignId/sessions`

* `GET /api/sessions/:sessionId`

* `PATCH /api/sessions/:sessionId`

* `DELETE /api/sessions/:sessionId`

### **Recordings**

* Upload (two supported strategies):

  * Simple (server upload):

    * `POST /api/sessions/:sessionId/recordings` (multipart)

  * Scalable (direct-to-S3):

    * `POST /api/uploads/presign` → presigned URL

    * `POST /api/sessions/:sessionId/recordings/confirm` → create DB row

* List:

  * `GET /api/sessions/:sessionId/recordings`

* Playback URL:

  * `GET /api/recordings/:recordingId/playback-url`

### **Transcription**

* Start:

  * `POST /api/recordings/:recordingId/transcribe` body: `{ formats: ["txt","docx","vtt","pdf"] }`

* Status:

  * `GET /api/transcriptions/:jobId`

* Webhook:

  * `POST /api/webhooks/elevenlabs/transcription`

### **Documents (transcript/summary)**

* `GET /api/documents/:documentId`

* `PATCH /api/documents/:documentId` body: `{ content, format }` → creates new version

* `GET /api/documents/:documentId/versions`

* `POST /api/documents/:documentId/restore` body: `{ versionId }`

* Summarize:

  * `POST /api/documents/:documentId/summarize`

### **Artifacts**

* `GET /api/artifacts/:artifactId` (metadata)

* `GET /api/artifacts/:artifactId/download` (signed URL or proxy)

* `GET /api/artifacts/:artifactId/stream` (proxy stream for local)

---

## **14\) Frontend state and composables**

### **State management**

* Pinia stores:

  * `useAuthStore`

  * `useCampaignStore` (current campaign, campaign list)

  * `useSessionStore` (session list/detail cache)

* Composables:

  * `useApi()` wrapper (typed fetch, error normalization)

  * `useArtifacts()` (download/playback URL resolution)

  * `useDocumentEditor()` (load/save/versions/autosave)

  * `useStorageSettings()` (resolved campaign storage provider)

### **Data fetching pattern**

* Use Nuxt server-side data fetching for initial page loads.

* Mutations via `/api/*` then optimistic UI updates.

---

## **15\) Validation, error handling, and UX “feel”**

### **Forms**

* All create/edit flows use a single “Edit Drawer/Modal” pattern:

  * left: fields

  * right (optional): preview / relationships / recent sessions

### **Errors**

* Normalize server errors to:

  * `code`, `message`, `fields` (for form errors)

* Show toast notifications \+ inline field errors.

### **Loading states**

* Skeletons on lists

* Progress indicator for uploads and transcription status

---

## **16\) Security considerations**

* Auth-protect all campaign resources.

* Webhooks:

  * Verify signature/secret

  * Rate-limit \+ log

* File uploads:

  * MIME validation (audio/video only)

  * Size limits (configurable)

  * Virus scan optional (phase 2\)

* Storage keys:

  * Never expose raw storage keys to clients; use signed URLs or proxy endpoints.

---

## **17\) Observability and auditability**

* Log:

  * transcription job creation, webhook receipt, artifact fetch success/fail

  * n8n summarize requests/responses (exclude huge content; store hashes)

* Optional audit table:

  * `activity_log(id, userId, campaignId, action, entityType, entityId, meta, createdAt)`

---

## **18\) Testing plan**

* Unit tests:

  * storage adapters (mocked)

  * webhook idempotency

  * version creation logic

* Integration tests:

  * recording upload → transcription job creation

  * webhook callback → artifact creation → transcript document update

* E2E (Playwright):

  * create campaign, add glossary entry, create session, upload recording, simulate webhook, view transcript, edit, restore version

---

## **19\) Deployment and configuration**

### **Environment variables (example set)**

* `DATABASE_URL`

* `AUTH_SECRET` (and OAuth keys if used)

* `ELEVENLABS_API_KEY`

* `ELEVENLABS_WEBHOOK_SECRET`

* `N8N_WEBHOOK_URL_DEFAULT`

* `STORAGE_PROVIDER_DEFAULT=local|s3|gdrive|db`

* `STORAGE_LOCAL_ROOT=/data/ddcm`

* `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

* `GDRIVE_SERVICE_ACCOUNT_JSON` (if used)

### **Scaling notes**

* Prefer direct-to-S3 uploads for large video.

* Use Redis queue workers for webhook fetch \+ retries if traffic grows.

---

## **20\) Concrete page-by-page functional specs**

### **Campaign Overview (`/campaigns/:campaignId`)**

* Shows:

  * current status text

  * active quests (top 5\)

  * next milestone

  * latest session \+ quick link to recordings/transcripts

* Actions:

  * update status (creates a `NOTES` document or just updates campaign field)

### **Glossary (`/glossary`)**

* List \+ filters by type

* Each entry:

  * name, short description

  * session tags (chips)

* Entry detail panel:

  * full description (markdown)

  * linked sessions

  * quick add link to a session

### **Sessions list (`/sessions`)**

* sortable list, search

* shows icons for:

  * has recording

  * transcript status (processing/completed)

  * has summary

### **Session detail (`/sessions/:sessionId`)**

* Recordings panel:

  * upload recording

  * list recordings with playback and transcribe button

* Transcript panel:

  * show transcript doc if exists

  * show formats available (txt/docx/vtt/pdf) as downloads

* Summary panel:

  * “Send to n8n” action

  * editable summary doc \+ versions

### **Recording detail (`/recordings/:recordingId`)**

* Playback

* Transcription job status and history

* “Start transcription” (formats picker)

* “View transcript” (links to document)

* “Use VTT subtitles” indicator

---

## **21\) Implementation checklist (developer handoff)**

1. Set up Nuxt 4 \+ Nuxt UI 4 \+ app-wide UI overrides.

2. Implement auth (email/password or OAuth). Gate all `/campaigns/*`.

3. Create Prisma schema \+ migrations.

4. Implement storage adapters \+ artifact service.

5. Implement recording upload (simple first, direct-to-S3 optional).

6. Implement ElevenLabs transcription start \+ job tracking \+ webhook.

7. Implement document \+ versioning API and editor UI.

8. Implement n8n summarize endpoint \+ summary document creation.

9. Implement playback with optional VTT track.

10. Add search, tagging, and polished empty/loading states.

