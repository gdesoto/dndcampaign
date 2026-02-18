import { prisma } from '#server/db/prisma'
import type { GlossaryType, QuestType } from '@prisma/client'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

type ApplyResult = {
  suggestionId: string
  status: 'APPLIED' | 'DISCARDED'
  entityId?: string
  entityType?: string
}

const resolveGlossaryType = (
  entityType: 'GLOSSARY' | 'PC' | 'NPC' | 'ITEM' | 'LOCATION',
  payloadType?: string
): GlossaryType => {
  if (entityType !== 'GLOSSARY') return entityType
  const normalized = (payloadType || '').toUpperCase()
  if (normalized === 'PC' || normalized === 'NPC' || normalized === 'ITEM' || normalized === 'LOCATION') {
    return normalized as GlossaryType
  }
  return 'NPC'
}

const normalizeAliases = (value?: unknown) => {
  if (!value) return null
  if (Array.isArray(value)) {
    const filtered = value.map((entry) => String(entry).trim()).filter(Boolean)
    return filtered.length ? filtered.join(', ') : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  return null
}

const parseDate = (value?: unknown) => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const normalizeQuestType = (value?: unknown): QuestType | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.toUpperCase()
  if (normalized === 'MAIN' || normalized === 'SIDE' || normalized === 'PLAYER') {
    return normalized as QuestType
  }
  return undefined
}

const hasPendingSuggestions = async (summaryJobId: string) => {
  const remaining = await prisma.summarySuggestion.count({
    where: { summaryJobId, status: 'PENDING' },
  })
  return remaining > 0
}

const ensureGlossarySessionLink = async (glossaryEntryId: string, sessionId: string) => {
  await prisma.glossarySessionLink.upsert({
    where: {
      glossaryEntryId_sessionId: {
        glossaryEntryId,
        sessionId,
      },
    },
    update: {},
    create: {
      glossaryEntryId,
      sessionId,
    },
  })
}

export class SummarySuggestionService {
  async applySuggestion(
    userId: string,
    suggestionId: string,
    payloadOverride?: Record<string, unknown>
  ): Promise<ApplyResult | null> {
    const suggestion = await prisma.summarySuggestion.findFirst({
      where: {
        id: suggestionId,
        summaryJob: { campaign: buildCampaignWhereForPermission(userId, 'summary.run') },
      },
      include: {
        summaryJob: true,
      },
    })

    if (!suggestion) return null
    if (suggestion.status !== 'PENDING') {
      return {
        suggestionId: suggestion.id,
        status: suggestion.status === 'DISCARDED' ? 'DISCARDED' : 'APPLIED',
        entityType: suggestion.entityType,
      }
    }

    if (suggestion.action === 'DISCARD') {
      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'DISCARDED' },
      })

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        await prisma.summaryJob.update({
          where: { id: suggestion.summaryJobId },
          data: { status: 'APPLIED' },
        })
      }

      return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
    }

    const originalPayload = suggestion.payload as Record<string, unknown>
    const payload = payloadOverride || originalPayload
    const match = (suggestion.match || {}) as Record<string, unknown>

    if (suggestion.entityType === 'SESSION') {
      if (suggestion.action !== 'UPDATE') {
        await prisma.summarySuggestion.update({
          where: { id: suggestion.id },
          data: { status: 'DISCARDED' },
        })

        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          await prisma.summaryJob.update({
            where: { id: suggestion.summaryJobId },
            data: { status: 'APPLIED' },
          })
        }

        return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
      }

      const updated = await prisma.session.update({
        where: { id: suggestion.summaryJob.sessionId },
        data: {
          title: typeof payload.title === 'string' ? payload.title : undefined,
          notes: typeof payload.notes === 'string' ? payload.notes : undefined,
        },
      })

      const sessionKeys: Array<'title' | 'notes'> = ['title', 'notes']
      const remainingPayload = { ...originalPayload }
      if (payloadOverride) {
        for (const key of sessionKeys) {
          if (key in payloadOverride) {
            delete remainingPayload[key]
          }
        }
      }

      const hasRemainingSessionFields =
        typeof remainingPayload.title === 'string' || typeof remainingPayload.notes === 'string'

      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: payloadOverride && hasRemainingSessionFields
          ? {
              status: 'PENDING',
              payload: remainingPayload,
            }
          : {
              status: 'APPLIED',
            },
      })

      if (!(payloadOverride && hasRemainingSessionFields)) {
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          await prisma.summaryJob.update({
            where: { id: suggestion.summaryJobId },
            data: { status: 'APPLIED' },
          })
        }
      }

      return {
        suggestionId: suggestion.id,
        status: 'APPLIED',
        entityId: updated.id,
        entityType: suggestion.entityType,
      }
    }

    if (payloadOverride) {
      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: { payload: payloadOverride },
      })
    }

    if (suggestion.entityType === 'QUEST') {
      let questId = typeof match.id === 'string' ? match.id : undefined
      if (!questId && typeof match.title === 'string') {
        const existing = await prisma.quest.findFirst({
          where: { title: match.title, campaignId: suggestion.summaryJob.campaignId },
        })
        questId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!questId) throw new Error('Quest match not found for update')
        const updated = await prisma.quest.update({
          where: { id: questId },
          data: {
            title: payload.title as string | undefined,
            description: payload.description as string | undefined,
            type: normalizeQuestType(payload.type),
            status: payload.status as 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD' | undefined,
            progressNotes: payload.progressNotes as string | undefined,
          },
        })
        await prisma.summarySuggestion.update({
          where: { id: suggestion.id },
          data: { status: 'APPLIED' },
        })
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          await prisma.summaryJob.update({
            where: { id: suggestion.summaryJobId },
            data: { status: 'APPLIED' },
          })
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = await prisma.quest.create({
        data: {
          campaignId: suggestion.summaryJob.campaignId,
          title: String(payload.title || 'New quest'),
          description: payload.description as string | undefined,
          type: normalizeQuestType(payload.type),
          status: payload.status as 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD' | undefined,
          progressNotes: payload.progressNotes as string | undefined,
        },
      })

      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPLIED' },
      })

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        await prisma.summaryJob.update({
          where: { id: suggestion.summaryJobId },
          data: { status: 'APPLIED' },
        })
      }

      return { suggestionId: suggestion.id, status: 'APPLIED', entityId: created.id, entityType: suggestion.entityType }
    }

    if (suggestion.entityType === 'MILESTONE') {
      let milestoneId = typeof match.id === 'string' ? match.id : undefined
      if (!milestoneId && typeof match.title === 'string') {
        const existing = await prisma.milestone.findFirst({
          where: { title: match.title, campaignId: suggestion.summaryJob.campaignId },
        })
        milestoneId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!milestoneId) throw new Error('Milestone match not found for update')
        const updated = await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            title: payload.title as string | undefined,
            description: payload.description as string | undefined,
            isComplete: payload.isComplete as boolean | undefined,
            completedAt: parseDate(payload.completedAt),
          },
        })
        await prisma.summarySuggestion.update({
          where: { id: suggestion.id },
          data: { status: 'APPLIED' },
        })
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          await prisma.summaryJob.update({
            where: { id: suggestion.summaryJobId },
            data: { status: 'APPLIED' },
          })
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = await prisma.milestone.create({
        data: {
          campaignId: suggestion.summaryJob.campaignId,
          title: String(payload.title || 'New milestone'),
          description: payload.description as string | undefined,
          isComplete: payload.isComplete as boolean | undefined,
          completedAt: parseDate(payload.completedAt),
        },
      })

      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPLIED' },
      })

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        await prisma.summaryJob.update({
          where: { id: suggestion.summaryJobId },
          data: { status: 'APPLIED' },
        })
      }

      return { suggestionId: suggestion.id, status: 'APPLIED', entityId: created.id, entityType: suggestion.entityType }
    }

    if (
      suggestion.entityType === 'GLOSSARY' ||
      suggestion.entityType === 'PC' ||
      suggestion.entityType === 'NPC' ||
      suggestion.entityType === 'ITEM' ||
      suggestion.entityType === 'LOCATION'
    ) {
      const type = resolveGlossaryType(
        suggestion.entityType,
        payload.type as string | undefined
      )
      let entryId = typeof match.id === 'string' ? match.id : undefined
      if (!entryId && typeof match.name === 'string') {
        const existing = await prisma.glossaryEntry.findFirst({
          where: { name: match.name, campaignId: suggestion.summaryJob.campaignId },
        })
        entryId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!entryId) throw new Error('Glossary match not found for update')
        const updated = await prisma.glossaryEntry.update({
          where: { id: entryId },
          data: {
            type,
            name: payload.name as string | undefined,
            description: payload.description as string | undefined,
            aliases: normalizeAliases(payload.aliases) || undefined,
          },
        })
        await ensureGlossarySessionLink(updated.id, suggestion.summaryJob.sessionId)
        await prisma.summarySuggestion.update({
          where: { id: suggestion.id },
          data: { status: 'APPLIED' },
        })
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          await prisma.summaryJob.update({
            where: { id: suggestion.summaryJobId },
            data: { status: 'APPLIED' },
          })
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = await prisma.glossaryEntry.create({
        data: {
          campaignId: suggestion.summaryJob.campaignId,
          type,
          name: String(payload.name || 'Unnamed entry'),
          description: String(payload.description || ''),
          aliases: normalizeAliases(payload.aliases) || undefined,
        },
      })
      await ensureGlossarySessionLink(created.id, suggestion.summaryJob.sessionId)

      await prisma.summarySuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPLIED' },
      })

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        await prisma.summaryJob.update({
          where: { id: suggestion.summaryJobId },
          data: { status: 'APPLIED' },
        })
      }

      return { suggestionId: suggestion.id, status: 'APPLIED', entityId: created.id, entityType: suggestion.entityType }
    }

    return null
  }

  async discardSuggestion(userId: string, suggestionId: string): Promise<ApplyResult | null> {
    const suggestion = await prisma.summarySuggestion.findFirst({
      where: {
        id: suggestionId,
        summaryJob: { campaign: buildCampaignWhereForPermission(userId, 'summary.run') },
      },
    })

    if (!suggestion) return null

    await prisma.summarySuggestion.update({
      where: { id: suggestion.id },
      data: { status: 'DISCARDED' },
    })

    if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
      await prisma.summaryJob.update({
        where: { id: suggestion.summaryJobId },
        data: { status: 'APPLIED' },
      })
    }

    return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
  }
}
