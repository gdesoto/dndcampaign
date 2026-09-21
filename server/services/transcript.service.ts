import { prisma } from '#server/db/prisma'
import { apiError } from '#server/utils/http'
import type { TranscriptQuery } from '#shared/schemas/transcript'
import {
  readTranscriptLines,
  searchTranscriptLines,
  transcriptContentToLines,
} from '#shared/utils/transcript-reader'
import type {
  TranscriptReadResponse,
  TranscriptResponse,
  TranscriptSearchResponse,
} from '#shared/types/api/transcript'

type TranscriptResultWithoutIds =
  | Omit<TranscriptReadResponse, 'documentId' | 'versionId'>
  | Omit<TranscriptSearchResponse, 'documentId' | 'versionId'>

export class TranscriptService {
  async readForSession(sessionId: string, options: TranscriptQuery = {}): Promise<TranscriptResponse> {
    const document = await prisma.document.findFirst({
      where: { sessionId, type: 'TRANSCRIPT' },
      select: {
        id: true,
        versions: {
          ...(options.versionId ? { where: { id: options.versionId } } : {}),
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, content: true },
        },
      },
    })
    if (!document) throw apiError(404, 'NOT_FOUND', 'Session transcript not found')

    const selectedVersion = document.versions[0]
    if (!selectedVersion) throw apiError(404, 'NOT_FOUND', 'Transcript version not found')

    const lines = transcriptContentToLines(selectedVersion.content)
    let response: TranscriptResultWithoutIds
    try {
      response = options.q === undefined
        ? readTranscriptLines(lines, options)
        : searchTranscriptLines(lines, options.q, options)
    } catch (error) {
      if (error instanceof RangeError && options.q === undefined) {
        throw apiError(400, 'INVALID_RANGE', error.message)
      }
      throw error
    }
    return { ...response, documentId: document.id, versionId: selectedVersion.id }
  }
}
