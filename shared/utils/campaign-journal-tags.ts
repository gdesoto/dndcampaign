const customTagPattern = /(^|[^\w])#([A-Za-z][\w-]{0,63})\b/g
const glossaryMentionPattern = /\[\[([^[\]\r\n]+)\]\]/g

const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

export const normalizeJournalTagLabel = (value: string) =>
  collapseWhitespace(value)
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')

export const normalizeGlossaryMentionLabel = (value: string) => collapseWhitespace(value)

const dedupe = (values: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export const extractCustomHashtagsFromMarkdown = (markdown: string) => {
  if (!markdown) return []
  const matches: string[] = []
  for (const match of markdown.matchAll(customTagPattern)) {
    const label = normalizeJournalTagLabel(match[2] ?? '')
    if (!label) continue
    matches.push(label)
  }
  return dedupe(matches)
}

export const extractGlossaryMentionsFromMarkdown = (markdown: string) => {
  if (!markdown) return []
  const matches: string[] = []
  for (const match of markdown.matchAll(glossaryMentionPattern)) {
    const label = normalizeGlossaryMentionLabel(match[1] ?? '')
    if (!label) continue
    matches.push(label)
  }
  return dedupe(matches)
}

export type CampaignJournalExtractedTagCandidates = {
  customTags: string[]
  glossaryMentions: string[]
}

export const extractJournalTagCandidatesFromMarkdown = (
  markdown: string
): CampaignJournalExtractedTagCandidates => ({
  customTags: extractCustomHashtagsFromMarkdown(markdown),
  glossaryMentions: extractGlossaryMentionsFromMarkdown(markdown),
})
