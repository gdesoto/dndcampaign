import { describe, expect, it } from 'vitest'
import {
  searchTranscriptLines,
  transcriptContentToLines,
} from '../../shared/utils/transcript-reader'

describe('transcript reader', () => {
  it('normalizes newlines and preserves blank lines', () => {
    expect(transcriptContentToLines('one\r\n\r\ntwo\r\n')).toEqual(['one', '', 'two'])
  })

  it('renders structured segments instead of exposing JSON syntax', () => {
    expect(transcriptContentToLines(JSON.stringify({
      version: 1,
      segments: [{ id: 'a', text: 'Hello', speaker: 'DM' }],
    }))).toEqual(['DM: Hello'])
  })

  it('searches literally and merges overlapping context', () => {
    const result = searchTranscriptLines(['a', 'Needle', 'c', 'NEEDLE', 'e'], 'needle', {
      contextLines: 1,
    })
    expect(result.totalMatches).toBe(2)
    expect(result.totalResults).toBe(1)
    expect(result.matches[0]).toMatchObject({
      startLine: 1,
      endLine: 5,
      matchingLineNumbers: [2, 4],
    })
  })

  it('pages search passages while retaining transcript line numbers and totals', () => {
    const result = searchTranscriptLines(['needle', 'a', 'b', 'c', 'needle', 'd'], 'needle', {
      contextLines: 1,
      offset: 1,
      limit: 1,
    })
    expect(result).toMatchObject({ totalLines: 6, totalMatches: 2, totalResults: 2, hasMore: false })
    expect(result.matches).toEqual([{
      startLine: 4,
      endLine: 6,
      matchingLineNumbers: [5],
      lines: [
        { lineNumber: 4, text: 'c' },
        { lineNumber: 5, text: 'needle' },
        { lineNumber: 6, text: 'd' },
      ],
    }])
  })
})
