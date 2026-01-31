## **0\) Non-negotiable decisions (so devs don’t bikeshed)**

### **Stack**

* **Nuxt 4** (SSR on)

* **Nuxt UI 4** for components

* **TypeScript everywhere**

* **Sqlite \+ Prisma**

* **Auth**: Nuxt Auth (or Lucia) with cookie-based sessions

* **Validation**: Zod (shared schemas for server \+ client)

* **Editor**: Markdown editor (TipTap or Monaco/Markdown; pick one early)

* **Storage abstraction** with adapters:

  * Local filesystem (baseline)

  * S3-compatible (baseline)

  * Google Drive (phase 2 unless required day-1)

  * DB blobs only for small files (avoid for media)

### **Content model choices**

* Canonical editable text stored as **Markdown** in `document_versions.content`.

* Transcripts can additionally store **format artifacts** (txt/docx/vtt/pdf) as downloadable `artifacts`.

* All webhooks are **idempotent** and **authenticated** via shared secret/signature.

---

## **1\) Repository structure (Nuxt 4\)**

### **Top-level**

`/app`  
  `/components`  
    `/app        (AppShell, AppPage, AppToolbar, AppEmptyState, etc.)`  
    `/campaign   (CampaignSwitcher, CampaignOverviewCards)`  
    `/glossary   (GlossaryTable, GlossaryEditor)`  
    `/sessions   (SessionList, SessionDetailPanels)`  
    `/recordings (RecordingUploader, RecordingPlayer, TranscriptionStatus)`  
    `/documents  (DocumentEditor, VersionHistory, DiffViewer[phase2])`  
  `/composables`  
    `useApi.ts`  
    `useAuth.ts`  
    `useCampaign.ts`  
    `useArtifacts.ts`  
    `useDocuments.ts`  
    `useStorageSettings.ts`  
  `/layouts`  
    `default.vue        (public minimal)`  
    `app.vue            (authenticated shell)`  
  `/middleware`  
    `auth.global.ts     (redirect if not logged in)`  
  `/pages`  
    `/login.vue`  
    `/campaigns/index.vue`  
    `/campaigns/[campaignId]/index.vue`  
    `/campaigns/[campaignId]/glossary.vue`  
    `/campaigns/[campaignId]/quests.vue`  
    `/campaigns/[campaignId]/milestones.vue`  
    `/campaigns/[campaignId]/sessions/index.vue`  
    `/campaigns/[campaignId]/sessions/[sessionId].vue`  
    `/campaigns/[campaignId]/recordings/[recordingId].vue`  
    `/campaigns/[campaignId]/documents/[documentId].vue`  
    `/settings.vue`  
    `/campaigns/[campaignId]/settings.vue`  
  `/stores`  
    `auth.ts`  
    `campaigns.ts`  
    `sessions.ts`  
  `/utils`  
    `format.ts`  
    `status.ts`  
`/server`  
  `/api`  
    `/auth/*`  
    `/campaigns/*`  
    `/glossary/*`  
    `/quests/*`  
    `/milestones/*`  
    `/sessions/*`  
    `/recordings/*`  
    `/documents/*`  
    `/artifacts/*`  
    `/uploads/*`  
    `/webhooks/*`  
  `/services`  
    `auth.service.ts`  
    `campaign.service.ts`  
    `glossary.service.ts`  
    `session.service.ts`  
    `recording.service.ts`  
    `transcription.service.ts`  
    `document.service.ts`  
    `summary.service.ts`  
    `artifact.service.ts`  
    `storage/`  
      `storage.types.ts`  
      `storage.factory.ts`  
      `local.adapter.ts`  
      `s3.adapter.ts`  
      `gdrive.adapter.ts (phase 2)`  
  `/db`  
    `prisma.ts`  
    `schema.prisma`  
  `/utils`  
    `http.ts (errors/response helpers)`  
    `validate.ts (zod helper)`  
    `idempotency.ts`  
    `security.ts (webhook verification)`  
`/shared`  
  `/schemas (Zod)`  
    `campaign.ts`  
    `glossary.ts`  
    `session.ts`  
    `recording.ts`  
    `transcription.ts`  
    `document.ts`  
    `artifact.ts`  
    `webhooks.ts`  
  `/types`  
    `index.ts`  
`/app.config.ts (Nuxt UI overrides)`  
`/nuxt.config.ts`

### **Conventions**

* Server routes are “thin controllers”: validate → call service → return DTO

* Services do all business logic; no direct Prisma calls in routes

* DTOs are explicit (don’t leak Prisma models directly)

* Shared Zod schemas define request/response payloads to keep client/server aligned

---

## **2\) Environment \+ config contract**

### **`.env` (baseline)**

* `DATABASE_URL=...`

* `AUTH_SECRET=...`

* `ELEVENLABS_API_KEY=...`

* `ELEVENLABS_WEBHOOK_SECRET=...`

* `N8N_WEBHOOK_URL_DEFAULT=...`

* `STORAGE_PROVIDER_DEFAULT=local|s3|gdrive|db`

* `STORAGE_LOCAL_ROOT=/data/ddcm`

* `S3_ENDPOINT=...`

* `S3_REGION=...`

* `S3_BUCKET=...`

* `S3_ACCESS_KEY=...`

* `S3_SECRET_KEY=...`

* `PUBLIC_APP_URL=https://...` (for webhook URLs)

### **Runtime config resolution**

Implement `resolveStorageConfig({ userId, campaignId })`:

1. campaign override

2. user override

3. global default

---

## **3\) Database implementation plan (Prisma)**

### **Tasks**

1. Create `schema.prisma` with tables from the SDD (users, campaigns, sessions, glossary\_entries, quests, milestones, recordings, transcription\_jobs, documents, document\_versions, artifacts, link tables).

2. Add indexes:

   * `(campaignId, type)` for glossary entries

   * `(sessionId)` for recordings

   * `externalJobId` unique for transcription jobs

   * `(documentId, versionNumber)` unique for versions

3. Add cascades carefully:

   * deleting campaign deletes sessions/glossary/quests/milestones/documents (but consider retaining artifacts if shared; simplest: cascade delete artifacts owned by campaign).

### **Acceptance criteria**

* `pnpm prisma migrate dev` runs cleanly

* Basic seed script can create user \+ campaign \+ session

---

## **4\) API build plan (Nitro server routes)**

### **Response envelope standard**

Use consistent JSON:

`{ "data": ..., "error": null }`

Errors:

`{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "name": "Required" } } }`

### **Endpoint list \+ payloads (developer-ready)**

#### **Auth**

* `POST /api/auth/login`

  * req: `{ email, password }`

  * res: `{ user: { id, email, name } }`

* `POST /api/auth/logout`

* `GET /api/auth/me`

#### **Campaigns**

* `GET /api/campaigns`

  * res: `CampaignSummary[]`

* `POST /api/campaigns`

  * req: `{ name, system?, description? }`

* `GET /api/campaigns/:campaignId`

* `PATCH /api/campaigns/:campaignId`

  * req: `{ name?, description?, currentStatus? }`

#### **Glossary**

* `GET /api/campaigns/:campaignId/glossary?type=PC|NPC|ITEM|LOCATION&search=...`

* `POST /api/campaigns/:campaignId/glossary`

  * req: `{ type, name, aliases?, description }`

* `PATCH /api/glossary/:entryId`

* `POST /api/glossary/:entryId/sessions/:sessionId` (tag entry with session)

* `DELETE /api/glossary/:entryId/sessions/:sessionId`

#### **Quests**

* `GET /api/campaigns/:campaignId/quests`

* `POST /api/campaigns/:campaignId/quests`

  * req: `{ title, description?, status?, progressNotes? }`

* `PATCH /api/quests/:questId`

* `DELETE /api/quests/:questId`

#### **Milestones**

* `GET /api/campaigns/:campaignId/milestones`

* `POST /api/campaigns/:campaignId/milestones`

  * req: `{ title, description? }`

* `PATCH /api/milestones/:milestoneId`

  * req: `{ title?, description?, isComplete?, completedAt? }`

#### **Sessions**

* `GET /api/campaigns/:campaignId/sessions`

* `POST /api/campaigns/:campaignId/sessions`

  * req: `{ title, sessionNumber?, playedAt?, notes? }`

* `GET /api/sessions/:sessionId`

* `PATCH /api/sessions/:sessionId`

#### **Recordings (simple multipart baseline)**

* `POST /api/sessions/:sessionId/recordings` (multipart form-data)

  * fields: `file`, `kind=AUDIO|VIDEO`, `durationSeconds?`

  * res: `RecordingDTO`

* `GET /api/sessions/:sessionId/recordings`

* `GET /api/recordings/:recordingId/playback-url`

  * res: `{ url, expiresAt }`

#### **Uploads (direct-to-S3 optional)**

* `POST /api/uploads/presign`

  * req: `{ filename, mimeType, byteSize, purpose: "recording" }`

  * res: `{ uploadUrl, fields?, storageKey, provider }`

* `POST /api/sessions/:sessionId/recordings/confirm`

  * req: `{ kind, storageKey, provider, filename, mimeType, byteSize, durationSeconds? }`

#### **Transcription**

* `POST /api/recordings/:recordingId/transcribe`

  * req: `{ formats: ["txt","docx","vtt","pdf"], language? }`

  * res: `{ jobId, status, externalJobId }`

* `GET /api/transcriptions/:jobId`

* `POST /api/webhooks/elevenlabs/transcription`

  * headers: `X-Webhook-Secret: ...` (or signature)

  * req: `{ externalJobId, status, ... }` (match provider)

  * behavior:

    * locate job by `externalJobId`

    * if already completed: 200 OK (idempotent)

    * else: fetch transcript artifacts → store → update job → create/update transcript document

#### **Documents (versioned)**

* `GET /api/documents/:documentId`

  * res: `{ document, currentVersion }`

* `PATCH /api/documents/:documentId`

  * req: `{ content, format:"MARKDOWN", source? }`

  * effect: create new version, update `currentVersionId`

* `GET /api/documents/:documentId/versions`

* `POST /api/documents/:documentId/restore`

  * req: `{ versionId }`

#### **Summarization (n8n)**

* `POST /api/documents/:documentId/summarize`

  * req: `{ webhookUrlOverride?, promptProfile?, mode:"sync|async" }`

  * res sync: `{ summaryDocumentId }`

  * res async: `{ trackingId }`

* Optional: `POST /api/webhooks/n8n/summary`

  * req: `{ trackingId, summaryContent, meta? }`

#### **Artifacts**

* `GET /api/artifacts/:artifactId`

* `GET /api/artifacts/:artifactId/download`

  * returns presigned url or streams

* `GET /api/artifacts/:artifactId/stream` (for local provider)

### **Acceptance criteria (API)**

* All endpoints enforce campaign ownership

* Zod validation on every write endpoint

* Standard error envelope everywhere

---

## **5\) Service layer implementation tasks (server/services)**

### **5.1 Storage subsystem**

**Files**

* `server/services/storage/storage.types.ts`

* `server/services/storage/storage.factory.ts`

* `server/services/storage/local.adapter.ts`

* `server/services/storage/s3.adapter.ts`

**Key tasks**

* Implement `StorageAdapter` interface (put/get/signedUrl/delete/exists)

* Implement `ArtifactService`:

  * `createArtifactFromUpload(...)`

  * `getDownloadUrl(artifactId)`

  * `streamArtifact(artifactId)` (local)

* Add checksum support if feasible (sha256)

**Acceptance criteria**

* Upload a file locally and play it back via signed/proxy URL

* Swap provider to S3 and playback still works without code changes above adapter layer

### **5.2 RecordingService**

**Responsibilities**

* Validate upload type/size

* Store bytes via StorageAdapter

* Create `artifact` row \+ `recording` row

* Extract duration (optional; phase 2 with ffprobe)

**Acceptance criteria**

* Session detail page shows new recording immediately

* Playback URL works

### **5.3 TranscriptionService (ElevenLabs)**

**Responsibilities**

* `startTranscription(recordingId, formats)`

  * call provider API (recording bytes or URL)

  * persist `transcription_job` with `externalJobId`

* `handleWebhook(payload)`

  * verify secret

  * idempotency guard

  * fetch transcript outputs for requested formats

  * store as artifacts and link in `transcription_artifacts`

  * upsert transcript Document:

    * create Document if missing

    * add DocumentVersion with imported content (prefer txt as canonical if available; otherwise convert)

  * mark job completed/failed

**Acceptance criteria**

* Job created and status appears in UI as “Processing”

* When webhook is simulated, transcript document is created and downloadable formats appear

### **5.4 DocumentService (versioning)**

**Responsibilities**

* Create document \+ first version

* Update document (new version)

* List versions

* Restore version (set `currentVersionId`)

* Optional: autosave “draft” versions

**Acceptance criteria**

* Editing transcript creates a new version

* Restoring version updates displayed content

### **5.5 SummaryService (n8n)**

**Responsibilities**

* Build payload: campaign/session/document context \+ transcript content

* Post to webhook

* Handle sync response: create/update Summary Document \+ version

* Optional async tracking: store `summary_jobs` table (if implementing)

**Acceptance criteria**

* Clicking summarize creates a summary document and displays it in session page

* Summary is editable and versioned

---

## **6\) Frontend build plan (pages, components, stores)**

### **6.1 Global UI shell**

**Tasks**

* `layouts/app.vue` sidebar \+ top bar

* Campaign switcher component (loads campaigns store)

* Route middleware `auth.global.ts`

* `useApi()` composable:

  * attaches credentials

  * handles error envelope

  * returns typed `data`

**Acceptance criteria**

* Login redirects to campaigns

* Refresh keeps session (cookie auth)

### **6.2 Campaign pages**

**Pages**

* `/campaigns` list/create

* `/campaigns/[campaignId]` overview

**Components**

* Campaign cards, create modal/drawer

* Overview widgets (quests, milestones, latest session)

**Acceptance criteria**

* Create campaign and land on overview

### **6.3 Glossary**

**Page**

* `/campaigns/[campaignId]/glossary`

**Features**

* Tabs by type

* Search

* Create/edit entry drawer

* Session tagging UI:

  * show sessions linked

  * add/remove session link

**Acceptance criteria**

* Can create a PC and link it to a session

### **6.4 Sessions**

**Pages**

* list: `/campaigns/[campaignId]/sessions`

* detail: `/campaigns/[campaignId]/sessions/[sessionId]`

**Session detail panels**

* Notes panel (simple textarea → session.notes)

* Recordings panel:

  * upload

  * list recordings

  * transcribe action \+ status

* Transcript panel:

  * show transcript document if exists

  * downloads for txt/docx/vtt/pdf

  * open editor

* Summary panel:

  * send to n8n

  * show/edit summary

**Acceptance criteria**

* Full “happy path”: create session → upload recording → transcribe → view transcript → summarize → edit summary

### **6.5 Recording detail \+ playback**

**Page**

* `/campaigns/[campaignId]/recordings/[recordingId]`

**Features**

* Playback audio/video

* If VTT exists: attach subtitles track

* Show transcription job history/status

**Acceptance criteria**

* Video shows subtitles when VTT artifact exists

### **6.6 Document editor \+ version history**

**Page**

* `/campaigns/[campaignId]/documents/[documentId]`

**UI**

* Main editor (Markdown)

* Right rail: version history list \+ restore button

* Autosave indicator (optional)

**Acceptance criteria**

* Editing produces versions; restoring changes content

---

## **7\) UI override strategy (Nuxt UI 4\)**

### **Tasks**

* Create `app.config.ts` with centralized defaults for:

  * buttons, inputs, textareas, cards, badges, tables, modals/drawers

* Create semantic wrapper components:

  * `AppPage` (title \+ actions slot \+ breadcrumbs)

  * `AppSection` (carded section)

  * `AppEmptyState` (icon, title, body, primary action)

  * `StatusBadge` (maps enum → badge variant)

### **Acceptance criteria**

* Components across pages look consistent without per-instance styling noise

---

## **8\) Webhook security \+ idempotency plan**

### **Verification**

* Implement `verifyWebhook(req)`:

  * Prefer signature verification if provider supports it

  * Otherwise: shared secret header `X-Webhook-Secret`

### **Idempotency**

* Use `transcription_jobs.externalJobId` unique

* On webhook:

  * if job status already `COMPLETED`, return 200 OK immediately

### **Acceptance criteria**

* Re-sending the same webhook doesn’t create duplicate artifacts or versions

---

## **9\) Test plan (developer-executable)**

### **Unit tests**

* Storage adapters (mock S3 client)

* Document versioning logic

* Webhook idempotency behavior

### **Integration tests**

* Upload → recording row created

* Start transcription → transcription\_job created

* Webhook → artifacts \+ transcript document created

### **E2E tests (Playwright)**

* Login → create campaign → create session → upload recording → “simulate webhook” endpoint (dev-only) → transcript shows → summarize shows → edit \+ restore works

*(Add a dev-only route gated by `NODE_ENV !== 'production'` to simulate webhook payloads.)*

---

## **10\) Implementation order (milestones, no fluff)**

### **Milestone A — Skeleton \+ Auth \+ DB**

* Nuxt app shell \+ auth \+ prisma migrations

* Campaign CRUD \+ campaign list UI

### **Milestone B — Sessions \+ Glossary (core campaign tracking)**

* Sessions CRUD

* Glossary CRUD \+ session-tag linking

* Quests \+ milestones CRUD

### **Milestone C — Recordings \+ Storage abstraction**

* Local storage adapter

* Recording upload \+ playback (proxy endpoint)

* Artifacts metadata

### **Milestone D — ElevenLabs transcription**

* Start transcription endpoint

* Webhook endpoint \+ artifact ingestion

* Transcript document creation

### **Milestone E — Document editing \+ version history**

* Document editor page

* Version history \+ restore

* Editable transcript \+ summary

### **Milestone F — n8n summarization**

* Send transcript to n8n webhook

* Create summary doc \+ versioning

### **Milestone G — S3 direct upload (optional but recommended)**

* Presign endpoint

* Confirm endpoint

* Playback via presigned URLs

---

## **11\) “Definition of done” checklist (ship-ready)**

* All CRUD pages usable with consistent UI styling

* Upload \+ playback works for audio and video

* Transcription job lifecycle works end-to-end with webhook

* Transcript formats stored as artifacts and downloadable

* Transcript and summary editable with version history \+ restore

* n8n summarization works with stored result

* Storage provider swap doesn’t change business logic

* Webhooks are authenticated \+ idempotent

* Basic E2E tests cover happy path