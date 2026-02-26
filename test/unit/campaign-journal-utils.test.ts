import { describe, expect, it } from 'vitest'
import {
  campaignJournalListQuerySchema,
  publicCampaignJournalListQuerySchema,
} from '../../shared/schemas/campaign-journal'
import {
  extractCustomHashtagsFromMarkdown,
  extractGlossaryMentionsFromMarkdown,
  extractJournalTagCandidatesFromMarkdown,
  normalizeGlossaryMentionLabel,
  normalizeJournalTagLabel,
} from '../../shared/utils/campaign-journal-tags'
import { parseCampaignMarkdown } from '../../server/utils/markdown'

describe('campaign journal tag utilities', () => {
  it('normalizes and deduplicates custom hashtags', () => {
    const markdown = `
      #Clue #clue
      We found #Arc-One and #arc one.
      Ignore invalid tags like #123 and #.
    `

    expect(extractCustomHashtagsFromMarkdown(markdown)).toEqual(['clue', 'arc-one', 'arc'])
    expect(normalizeJournalTagLabel(' #Arc One! ')).toBe('arc-one')
  })

  it('extracts and deduplicates glossary mentions', () => {
    const markdown = `
      [[Ancient Relic]]
      [[ Ancient   Relic ]]
      [[Raven Queen]]
    `

    expect(extractGlossaryMentionsFromMarkdown(markdown)).toEqual([
      'Ancient Relic',
      'Raven Queen',
    ])
    expect(normalizeGlossaryMentionLabel('  Raven   Queen ')).toBe('Raven Queen')
  })

  it('returns combined extracted candidates from markdown', () => {
    const candidates = extractJournalTagCandidatesFromMarkdown(
      'Track #Mystery and [[Grey Harbor]] plus #mystery'
    )
    expect(candidates.customTags).toEqual(['mystery'])
    expect(candidates.glossaryMentions).toEqual(['Grey Harbor'])
  })
})

describe('campaign journal schemas and markdown parsing', () => {
  it('applies query defaults for member and public list endpoints', () => {
    const memberQuery = campaignJournalListQuerySchema.parse({})
    expect(memberQuery.page).toBe(1)
    expect(memberQuery.pageSize).toBe(20)

    const publicQuery = publicCampaignJournalListQuerySchema.parse({})
    expect(publicQuery.page).toBe(1)
    expect(publicQuery.pageSize).toBe(20)
  })

  it('rejects oversized page size in public query schema', () => {
    const parsed = publicCampaignJournalListQuerySchema.safeParse({
      pageSize: 1000,
    })
    expect(parsed.success).toBe(false)
  })

  it('parses markdown without preserving executable script tags', async () => {
    const parsed = await parseCampaignMarkdown(
      '# Journal\n\nSafe text<script>alert("x")</script>\n\n- item'
    )
    const serialized = JSON.stringify(parsed).toLowerCase()

    expect(serialized).toContain('journal')
    expect(serialized).not.toContain('<script>')
    expect(serialized).not.toContain('alert("x")')
  })
})
