import { expect, it } from 'vitest'
import { extractJournalTagCandidatesFromMarkdown } from '../../shared/utils/campaign-journal-tags'

it('extracts normalized, deduplicated tags and glossary mentions from journal prose', () => {
  expect(extractJournalTagCandidatesFromMarkdown(`
    #Clue #clue #Arc-One; ignore #123 and #.
    [[Ancient Relic]] [[ Ancient   Relic ]] [[Raven Queen]]
  `)).toEqual({
    customTags: ['clue', 'arc-one'],
    glossaryMentions: ['Ancient Relic', 'Raven Queen'],
  })
})
