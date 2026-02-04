# Transcript Editor Checklist

## Data + API
- [x] Add shared transcript segment type and parse/serialize utilities.
- [x] Support segmented JSON detection and conversion from SRT/VTT/plain text.
- [x] Add read-only segments endpoint for documents.
- [x] Allow larger document payloads for long transcripts.
- [x] Generate VTT from segmented transcripts when attaching subtitles.

## Editor UI
- [x] Segmented transcript list with speaker + timestamp.
- [x] Search with match navigation and highlighted matches.
- [x] Optional search filtering to matching segments.
- [x] Filters for speaker(s) and time range.
- [x] Jump-to-time from segment rows.
- [x] Windowed rendering to keep long transcripts responsive.
- [x] Save version and last-saved indicator.
- [x] Version history + restore preserved.
- [x] Speaker tools: bulk apply speaker, per-segment disable toggle.
- [x] Segment selection with enable/disable + speaker updates.

## Playback
- [x] Recording selector + in-page playback controls.
- [x] Audio/video sync via global media player.

## Session Page
- [x] Transcript preview handles segmented JSON.
- [x] Session page links into the transcript editor.
- [x] Disabled segments hidden from read-only previews.

## QA
- [x] Load existing plaintext transcript and verify segmentation.
- [x] Save edits and confirm new version created.
- [x] Attach VTT from segmented transcript.
