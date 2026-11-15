# Recording transcription

Recordings use ElevenLabs Scribe V3 (`scribe_v3`) by default. The recording detail
page submits transcription settings to
`POST /api/recordings/:recordingId/transcriptions` with `mode: "transcribe"`.
Existing API callers can still specify a different `modelId`.

The dialog supports speaker counts or a diarization threshold, audio event tags,
output formats, number formatting (automatic, digits, or words), a primary
language code, and secondary language codes. Leaving language hints blank lets
ElevenLabs detect the language. Number formatting and secondary languages are
V3 options; callers choosing older models should omit them.

Keyterms may be entered manually or added from the campaign glossary. The limit
is 1,000 terms, each with at most 50 characters and five words. ElevenLabs rejects
angle brackets, braces, square brackets, and backslashes in terms. Validation runs
before submission and on the server; failures preserve the dialog's input.
Keyterm prompting adds 20% to the base transcription cost. Requests with more
than 100 terms have a minimum billable duration of 20 seconds.

Jobs store the model ID and existing transcription metadata. Number formatting
and secondary language hints are request options rather than stored job fields.
The existing webhook/synchronous completion path retains downloadable artifacts;
users can apply a transcript or attach subtitle output to a recording. Switching
the default model does not modify existing jobs or transcripts.

See the [request schema](../shared/schemas/transcription.ts),
[service](../server/services/transcription.service.ts),
[OpenAPI contract](../public/openapi.json), and
[ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).
