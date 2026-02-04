# Transcript Editor Build Plan

## Goal
Build a dedicated, performant transcript editor suited for 4-6 hour sessions. Editing should be audio-synced, searchable, and segmented; the session page only links into this editor.

## Scope
- Replace raw textarea editing with a segmented transcript editor.
- Provide search, navigation, and audio sync features.
- Preserve version history and restore capabilities.
- Ensure performance with long transcripts (virtualization + chunking).

## Non-Goals (for this phase)
- Auto-alignment / forced alignment engine (can be Phase 2).
- Automatic glossary/quest extraction.
- Collaborative editing / multi-user cursors.

## Data + API Requirements
1. **Transcript segmentation model**
   - Represent transcript as an array of segments:
     - `id`, `startMs`, `endMs`, `speaker`, `text`, `confidence?`, `source`.
   - Store canonical document content as JSON or Markdown + embedded timecodes.
   - Add a conversion layer to/from the existing `DocumentVersion.content`.

2. **Playback metadata**
   - Store duration for recordings.
   - Optional waveform precompute endpoint (future).

3. **Editor endpoints (phase 1)**
   - Load transcript document and associated recording(s).
   - Save transcript edits as new version.
   - Expose a read-only 'segments' view derived from the transcript.

## UX / Editor Features
### Core (Phase 1)
- **Segmented editor**: list of transcript segments with speaker + timestamp.
- **Search**: full-text search, highlight results, jump to match.
- **Jump to time**: clicking a segment seeks audio/video player.
- **Audio player**: sticky mini-player with play/pause and speed controls.
- **Autosave indicator**: show 'last saved' timestamp and manual save.
- **Version history**: existing versions list and restore.

### Enhanced (Phase 2)
- **Speaker tools**: rename speaker, merge/split segments, set speaker on selection or filtered segments, disable segments from preview.
- **Selection tools**: select segments in bulk to enable/disable or set speaker.
- **Filters**: filter by speaker(s), time range, and optionally filter to search matches.
- **Keyboard shortcuts**: play/pause, jump �5s, next/prev match.
- **Side-by-side view**: waveform + segments.
- **Low-confidence marker**: highlight segments that need review.

## UI Layout (Editor Page)
- **Header**: title, back to session, 'Save version', last saved.
- **Left column**: segment list (virtualized), search bar.
- **Right column**: playback, segment details, speaker tools.
- **Bottom bar**: transport controls, speed, time display.

## Performance Plan
- Use windowed rendering (virtual list) for segments.
- Chunk data by time range (e.g., 5-10 minute windows).
- Avoid full-document re-renders on edits.

## Technical Tasks
1. **Data model**
   - Define segment structure and conversion to/from current document content.
   - Decide canonical storage format (JSON string in `DocumentVersion.content`).

2. **Editor UI**
   - Build segmented list with virtualization.
   - Add search + navigation.
   - Add sticky playback controls + audio sync.
   - Add speaker tools: rename, set speaker on selection/filtered, disable segments.
   - Add selection + filtering controls.

3. **Save workflow**
   - Convert segments -> content payload.
   - Save with existing `PATCH /api/documents/:documentId`.
   - Preserve version history + restore.

4. **Migration + compatibility**
   - If old transcript is plaintext, provide one-time conversion to segments.
   - Keep read-only preview in session page.

## Acceptance Criteria
- Loads a 4-6 hour transcript without UI lag.
- Search jumps to correct segment and time.
- Editing a segment updates content and saves as new version.
- Audio sync works for at least one recording.
- Version history + restore continue to work.
- Speaker tools allow bulk rename and per-segment disable for read-only preview.
- Selection and filtering allow bulk enable/disable + speaker updates and optional search filtering.

## Milestones
- **M1**: Segmented display + search + playback sync.
- **M2**: Editing + save + version history integration.
- **M3**: Speaker tools + performance polish.

## Risks / Open Questions
- Choosing canonical storage format (JSON vs Markdown+timecodes).
- Forced alignment for proper timed VTT generation (future).
- Handling multiple recordings per session.

## Implementation Notes (Completed)
- Canonical transcript storage is JSON in `DocumentVersion.content` with `{ version, segments }`.
- Backwards compatibility: plaintext/SRT/VTT is parsed into segments on load.
- VTT generation now detects segmented JSON and converts via timestamps.
- Session page only previews and links to the transcript editor.

## Completion Status
- [x] Segment model defined and conversion helpers added.
- [x] Transcript editor UI built (segmented list, search, jump-to-time).
- [x] Audio sync via global media player and recording selector.
- [x] Save/restore versions integrated with existing document endpoints.
- [x] VTT attachment handles segmented transcripts.
- [x] Speaker tools: bulk apply speaker, per-segment disable in preview.
- [x] Selection + filters + search filter toggle.
