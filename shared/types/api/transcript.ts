export type TranscriptLine = {
  lineNumber: number
  text: string
}

export type TranscriptReadResponse = {
  mode: 'read'
  documentId: string
  versionId: string
  totalLines: number
  startLine: number
  endLine: number
  lines: TranscriptLine[]
}

export type TranscriptSearchPassage = {
  startLine: number
  endLine: number
  matchingLineNumbers: number[]
  lines: TranscriptLine[]
}

export type TranscriptSearchResponse = {
  mode: 'search'
  documentId: string
  versionId: string
  totalLines: number
  query: string
  contextLines: number
  offset: number
  limit: number
  totalMatches: number
  totalResults: number
  hasMore: boolean
  matches: TranscriptSearchPassage[]
}

export type TranscriptResponse = TranscriptReadResponse | TranscriptSearchResponse
