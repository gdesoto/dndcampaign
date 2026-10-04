import { and, desc, eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { document, documentVersion } from '#server/db/schema'
import { apiError } from '#server/utils/http'
import type { TranscriptQuery } from '#shared/schemas/transcript'
import { readTranscriptLines, searchTranscriptLines, transcriptContentToLines } from '#shared/utils/transcript-reader'
import type { TranscriptReadResponse, TranscriptResponse, TranscriptSearchResponse } from '#shared/types/api/transcript'

type TranscriptResultWithoutIds = Omit<TranscriptReadResponse, 'documentId' | 'versionId'> | Omit<TranscriptSearchResponse, 'documentId' | 'versionId'>

export class TranscriptService {
  async readForSession(sessionId: string, options: TranscriptQuery = {}): Promise<TranscriptResponse> {
    const transcriptDocument = db.select({ id: document.id }).from(document).where(and(eq(document.sessionId, sessionId), eq(document.type, 'TRANSCRIPT'))).get()
    if (!transcriptDocument) throw apiError(404, 'NOT_FOUND', 'Session transcript not found')
    const selectedVersion = db.select({ id: documentVersion.id, content: documentVersion.content }).from(documentVersion)
      .where(and(eq(documentVersion.documentId, transcriptDocument.id), options.versionId ? eq(documentVersion.id, options.versionId) : undefined))
      .orderBy(desc(documentVersion.versionNumber)).get()
    if (!selectedVersion) throw apiError(404, 'NOT_FOUND', 'Transcript version not found')
    const lines = transcriptContentToLines(selectedVersion.content)
    let response: TranscriptResultWithoutIds
    try {
      response = options.q === undefined ? readTranscriptLines(lines, options) : searchTranscriptLines(lines, options.q, options)
    } catch (error) {
      if (error instanceof RangeError && options.q === undefined) throw apiError(400, 'INVALID_RANGE', error.message)
      throw error
    }
    return { ...response, documentId: transcriptDocument.id, versionId: selectedVersion.id }
  }
}
