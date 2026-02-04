# Milestone E Checklist (ElevenLabs Transcription)

Status legend: [ ] not started, [~] in progress, [x] done.

## 1) Database + Prisma
- [x] Add transcription job + transcription artifact models and enums
- [x] Relate transcription jobs to recordings and artifacts
- [x] Extend DocumentSource with ELEVENLABS_IMPORT
- [x] Run migration to add transcription tables

## 2) Service layer
- [x] Add TranscriptionService to start jobs with ElevenLabs client
- [x] Normalize webhook payloads and ingest artifacts
- [x] Support loading stored artifacts for post-processing

## 3) API routes
- [x] POST /api/recordings/:recordingId/transcribe
- [x] GET /api/recordings/:recordingId/transcriptions
- [x] GET /api/transcriptions/:jobId
- [x] POST /api/transcriptions/:jobId/apply-transcript
- [x] POST /api/transcriptions/:jobId/attach-vtt
- [x] POST /api/webhooks/elevenlabs/transcription (secret-guarded)

## 4) UI (Recordings + Sessions)
- [x] Add transcribe entry point from session recordings list
- [x] Add transcription modal with numSpeakers/keyterms/formats
- [x] Show transcription job status + artifacts
- [x] Add actions to apply TXT as transcript and SRT as VTT

## 5) Acceptance checks
- [x] Start transcription with formats + options
- [x] Webhook stores artifacts and completes job
- [x] Apply TXT to session transcript document
- [x] Attach SRT output as VTT subtitles for video recordings
- [x] App runs successfully and tests pass
