import { describe, expect, it } from 'vitest'
import { transcriptionStartSchema } from '../../shared/schemas/transcription'

describe('recorded transcription requests', () => {
  it('defaults to Scribe v3 and accepts its formatting, language hints and 1000 campaign terms', () => {
    const request = {
      formats: ['txt', 'srt', 'segmented_json'], numSpeakers: 8,
      keyterms: Array.from({ length: 1000 }, (_, index) => `NPC ${index}`),
      numbersFormat: 'digits', languageCode: 'en', secondaryLanguageCodes: ['es', 'fr'],
    }
    expect(transcriptionStartSchema.parse(request)).toMatchObject({ ...request, modelId: 'scribe_v3' })
    expect(transcriptionStartSchema.parse({ formats: ['txt'], diarize: false }).modelId).toBe('scribe_v3')
    for (const invalid of [
      { keyterms: [...request.keyterms, 'one too many'] },
      { keyterms: ['a'.repeat(51)] },
      { keyterms: ['one two three four five six'] },
      { keyterms: ['invalid[term]'] },
      { numbersFormat: 'roman' },
      { secondaryLanguageCodes: ['not-a-language'] },
      { numSpeakers: 33 },
      { diarizationThreshold: 0.22 },
    ]) {
      expect(transcriptionStartSchema.safeParse({ ...request, ...invalid }).success).toBe(false)
    }
    expect(transcriptionStartSchema.safeParse({ formats: ['txt'], numSpeakers: 8, modelId: 'scribe_v2' }).success).toBe(true)
  })
})
