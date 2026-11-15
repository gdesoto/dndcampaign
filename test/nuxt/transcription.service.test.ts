import { afterEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { TranscriptionService } from '#server/services/transcription.service'
import { transcriptionStartSchema } from '#shared/schemas/transcription'

const mocks = vi.hoisted(() => ({ convert: vi.fn(), insert: vi.fn(), update: vi.fn(), getObject: vi.fn() }))
vi.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: class { speechToText = { convert: mocks.convert } },
}))
vi.mock('#server/db/client', () => ({
  db: {
    insert: () => ({ values: (data: unknown) => ({ returning: () => ({ get: () => mocks.insert(data) }) }) }),
    update: () => ({ set: (data: unknown) => ({ where: () => ({ returning: () => ({ get: () => mocks.update(data) }) }) }) }),
  },
}))
vi.mock('#server/services/storage/storage.factory', () => ({
  getStorageAdapter: () => ({ getObject: mocks.getObject }),
}))

describe('Scribe V3 submission', () => {
  afterEach(() => { vi.resetAllMocks() })

  it('forwards V3 settings and 1000 terms, correlates async jobs, and records provider failures', async () => {
    const options = transcriptionStartSchema.parse({
      formats: ['txt', 'srt'], numSpeakers: 6, languageCode: 'en',
      secondaryLanguageCodes: ['es'], numbersFormat: 'words',
      keyterms: Array.from({ length: 1000 }, (_, index) => `NPC ${index}`),
    })
    mocks.insert.mockReturnValue({ id: 'job-1' })
    mocks.update.mockImplementation(data => data)
    mocks.getObject.mockImplementation(async () => ({ stream: Readable.from(['audio']) }))
    mocks.convert.mockResolvedValue({ requestId: 'request-1' })
    const service = new TranscriptionService('test-key', 'webhook-1', true)
    const input = { ...options, recordingId: 'recording-1', sessionId: 'session-1', campaignId: 'campaign-1', storageKey: 'audio.mp3' }
    await expect(service.startTranscription(input)).resolves.toMatchObject({ status: 'SENT', requestId: 'request-1' })
    expect(mocks.convert).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'scribe_v3', numbersFormat: 'words', languageCode: 'en', secondaryLanguageCodes: ['es'],
      keyterms: options.keyterms, numSpeakers: 6, diarize: true, tagAudioEvents: false,
      webhook: true, webhookId: 'webhook-1',
      webhookMetadata: { transcriptionJobId: 'job-1', recordingId: 'recording-1', sessionId: 'session-1', campaignId: 'campaign-1' },
    }))
    const failure = new Error('Provider unavailable')
    mocks.convert.mockRejectedValue(failure)
    await expect(service.startTranscription(input)).rejects.toBe(failure)
    expect(mocks.update).toHaveBeenLastCalledWith({ status: 'FAILED', errorMessage: 'Provider unavailable' })
  })
})
