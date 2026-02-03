# Transcribe Process

User will upload an audio recording as an artifact. Once uploaded, they should see a button to transcribe the audio. That button launches a form that gives them some customization options (num_speakers, keyterms). Once the user submits the form the server will:

1. Create a transcription job and set the status to Sending
2. Initiate a STT transcription POST request to Eleven Labs with a webhook_url.
3. Eleven Labs will return: message, request_id, transcription_id
4. Store the returned values from Eleven Labs in the transcription job and set the status to Sent.
5. Wait for webhook endpoint to be hit. (Or allow the user to initiate the server to try to manually get the transcript)
6. Receive and store transcription data as artifacts, and set the status as completed.
7. For the received txt format, the user should see a button to set it as the Session's transcript in the UI. For the srt, they should see a button to assign it to a video and go through the existing convert to VTT process.

## Eleven Labs Endpoints
Start Speech to Text Transcription: [POST] https://api.elevenlabs.io/v1/speech-to-text
Get Completed Transcription: [GET] https://api.elevenlabs.io/v1/speech-to-text/transcripts/:transcription_id

Credentials: [HEADER] xi-api-key=(create ENV variable to store this)

## Eleven Labs JS Library

Library: @elevenlabs/elevenlabs-js

### Example Library Calls
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
async function createTranscript() {
    const client = new ElevenLabsClient({
        environment: "https://api.elevenlabs.io",
    });
    await client.speechToText.convert({});
}
main();

async function getTranscript() {
    const client = new ElevenLabsClient({
        environment: "https://api.elevenlabs.io",
    });
    await client.speechToText.transcripts.get("transcription_id");
}

### Form Data

model_id=scribe_v2
diarize=true
additional_formats=
{{(()=>{
return JSON.stringify([
  { format: 'segmented_json' },
  { format: 'txt' },
  { format: 'html' },
  { format: 'srt' },
]);
})()}}
webhook=(defaults to false, but create ENV variable to enable server webhook endpoint)
webhook_id=(Create ENV variable to store this)
webhook_metadata=(json object converted to string of values wanted with the webhook payload)
num_speakers=(configurable via UI transcribe form with default of 12)

keyterms=(array of string to bias the transcription towards. This should initially be names from the glossary, and then configurable via the UI transcribe form. The number of keyterms cannot exceed 100. The length of each keyterm must be less than 50 characters. Keyterms can contain at most 5 words (after normalisation). For example [“hello”, “world”, “technical term”])


file=[binary data file. this should be the default option]
OR
cloud_storage_url=(Public URL to have ElevenLabs download the file from)

### Webhook Payload Example

Eleven Labs webhook request payload can be validated via HMAC signatures.

"body": {
    "type": "speech_to_text_transcription",
    "event_timestamp": 1769137174,
    "data": {
        "request_id": "098ba309e53d457db51e35b9449caee0",
        "transcription": {
        "language_code": "en",
        "language_probability": 0.98,
        "text": "Hello world!",
        "words": [
            {
            "text": "Hello",
            "start": 0,
            "end": 0.5,
            "type": "word",
            "speaker_id": "speaker_1",
            "logprob": -0.124
            }
        ],
        "channel_index": null
        "additional_formats": [
            {
            "requested_format": "segmented_json",
            "file_extension": "json",
            "content_type": "application/json",
            "is_base64_encoded": false,
            "content": "Hello"
            },
            {
            "requested_format": "docx",
            "file_extension": "docx",
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "is_base64_encoded": true,
            "content": "base64contentstring"
            }
            {
            "requested_format": "pdf",
            "file_extension": "pdf",
            "content_type": "application/pdf",
            "is_base64_encoded": true,
            "content": "base64contentstring"
            },
            {
            "requested_format": "txt",
            "file_extension": "txt",
            "content_type": "text/plain",
            "is_base64_encoded": false,
            "content": "Hello"
            },
            {
            "requested_format": "html",
            "file_extension": "html",
            "content_type": "text/html",
            "is_base64_encoded": false,
            "content": "Hello"
            },
            {
            "requested_format": "srt",
            "file_extension": "srt",
            "content_type": "text/srt",
            "is_base64_encoded": false,
            "content": "Hello"
            },
        ]
        "transcription_id": "nJn7Iy1UFLm5T0aEpd7L",
        "entities": null
        },
        "webhook_metadata": {
        "filename": "Session 1234 - 2026-01-22",
        "original_filename": "audio1033361539_15min_fast.wav",
        "session_number": 1234,
        "move_file": false
        }
    }
}
