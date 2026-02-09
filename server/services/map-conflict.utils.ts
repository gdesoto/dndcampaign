import type { GlossaryType } from '@prisma/client'

export const buildGlossaryConflictCandidates = (
  entries: Array<{ id: string; type: GlossaryType; name: string; normalizedName: string; sourceMapFeatureId: string | null }>,
  feature: { id: string; normalizedName: string }
) => {
  const candidates: Array<{
    glossaryEntryId: string
    name: string
    type: GlossaryType
    confidence: number
    reasons: string[]
  }> = []

  const featureTokens = new Set(feature.normalizedName.split(' ').filter(Boolean))
  for (const entry of entries) {
    if (entry.sourceMapFeatureId === feature.id) {
      candidates.push({
        glossaryEntryId: entry.id,
        name: entry.name,
        type: entry.type,
        confidence: 1,
        reasons: ['already linked to this map feature'],
      })
      continue
    }

    if (!entry.normalizedName) continue
    if (entry.normalizedName === feature.normalizedName) {
      candidates.push({
        glossaryEntryId: entry.id,
        name: entry.name,
        type: entry.type,
        confidence: 0.99,
        reasons: ['exact normalized name match'],
      })
      continue
    }

    const entryTokens = new Set(entry.normalizedName.split(' ').filter(Boolean))
    const overlap = [...entryTokens].filter((token) => featureTokens.has(token)).length
    const tokenScore = overlap / Math.max(entryTokens.size, featureTokens.size, 1)
    if (tokenScore >= 0.72) {
      candidates.push({
        glossaryEntryId: entry.id,
        name: entry.name,
        type: entry.type,
        confidence: Number(tokenScore.toFixed(2)),
        reasons: ['high token similarity'],
      })
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}
