import type {
  TranscriptReadResponse,
  TranscriptSearchPassage,
  TranscriptSearchResponse,
} from '../types/api/transcript'
import { parseTranscriptSegments, isSegmentedTranscript } from './transcript'

export const DEFAULT_TRANSCRIPT_READ_LIMIT = 100
export const DEFAULT_TRANSCRIPT_SEARCH_LIMIT = 50
export const DEFAULT_TRANSCRIPT_CONTEXT_LINES = 5

/** Keep file-style line semantics while accepting both common newline encodings. */
export const transcriptContentToLines = (content: string): string[] => {
  const readableContent = isSegmentedTranscript(content)
    ? parseTranscriptSegments(content)
        .map((segment) => `${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`.trim())
        .join('\n\n')
    : content
  const normalized = readableContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized) return []
  const lines = normalized.split('\n')
  // A final newline terminates the preceding line; it does not create a phantom line.
  if (lines.at(-1) === '') lines.pop()
  return lines
}

export const readTranscriptLines = (
  lines: string[],
  options: { startLine?: number; limit?: number } = {}
): Omit<TranscriptReadResponse, 'documentId' | 'versionId'> => {
  const startLine = options.startLine ?? 1
  const limit = options.limit ?? DEFAULT_TRANSCRIPT_READ_LIMIT
  if (lines.length > 0 && startLine > lines.length) {
    throw new RangeError('startLine is beyond the end of the transcript')
  }
  const selected = lines.slice(startLine - 1, startLine - 1 + limit)
  return {
    mode: 'read',
    totalLines: lines.length,
    startLine,
    endLine: selected.length ? startLine + selected.length - 1 : startLine - 1,
    lines: selected.map((text, index) => ({ lineNumber: startLine + index, text })),
  }
}

export const searchTranscriptLines = (
  lines: string[],
  query: string,
  options: { contextLines?: number; offset?: number; limit?: number } = {}
): Omit<TranscriptSearchResponse, 'documentId' | 'versionId'> => {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) throw new RangeError('q must not be empty')
  const contextLines = options.contextLines ?? DEFAULT_TRANSCRIPT_CONTEXT_LINES
  const offset = options.offset ?? 0
  const limit = options.limit ?? DEFAULT_TRANSCRIPT_SEARCH_LIMIT
  const foldedQuery = normalizedQuery.toLocaleLowerCase()
  const matchingLineNumbers = lines.reduce<number[]>((result, line, index) => {
    if (line.toLocaleLowerCase().includes(foldedQuery)) result.push(index + 1)
    return result
  }, [])

  const passages: TranscriptSearchPassage[] = []
  for (const matchingLineNumber of matchingLineNumbers) {
    const startLine = Math.max(1, matchingLineNumber - contextLines)
    const endLine = Math.min(lines.length, matchingLineNumber + contextLines)
    const previous = passages.at(-1)
    if (previous && startLine <= previous.endLine) {
      previous.endLine = Math.max(previous.endLine, endLine)
      previous.matchingLineNumbers.push(matchingLineNumber)
      continue
    }
    passages.push({ startLine, endLine, matchingLineNumbers: [matchingLineNumber], lines: [] })
  }

  const paged = passages.slice(offset, offset + limit)
  for (const passage of paged) {
    passage.lines = lines.slice(passage.startLine - 1, passage.endLine).map((text, index) => ({
      lineNumber: passage.startLine + index,
      text,
    }))
  }

  return {
    mode: 'search',
    totalLines: lines.length,
    query: normalizedQuery,
    contextLines,
    offset,
    limit,
    totalMatches: matchingLineNumbers.length,
    totalResults: passages.length,
    hasMore: offset + paged.length < passages.length,
    matches: paged,
  }
}
