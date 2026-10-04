import type { JsonValue } from '#server/db/columns'
import { and, count, eq, inArray } from 'drizzle-orm'
import { db } from '#server/db/client'
import { summarySuggestion as summarySuggestionTable, glossarySessionLink as glossarySessionLinkTable, summaryJob as summaryJobTable, session as sessionTable, quest as questTable, milestone as milestoneTable, glossaryEntry as glossaryEntryTable } from '#server/db/schema'
import type { GlossaryType, QuestType} from '#server/db/schema'
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
  const remaining = (db.select({ count: count() }).from(summarySuggestionTable).where(and(eq(summarySuggestionTable.summaryJobId, summaryJobId), eq(summarySuggestionTable.status, 'PENDING'))).get()!.count)
  return remaining > 0
}

const ensureGlossarySessionLink = async (glossaryEntryId: string, sessionId: string) => {
  db.insert(glossarySessionLinkTable).values({
      glossaryEntryId,
      sessionId,
    }).onConflictDoNothing({ target: [glossarySessionLinkTable.glossaryEntryId, glossarySessionLinkTable.sessionId] }).run()
}

export class SummarySuggestionService {
  async applySuggestion(
    userId: string,
    suggestionId: string,
    payloadOverride?: Record<string, unknown>
  ): Promise<ApplyResult | null> {
    const suggestion = (db.query.summarySuggestion.findFirst({ where: and(eq(summarySuggestionTable.id, suggestionId), inArray(summarySuggestionTable.summaryJobId, db.select({ id: summaryJobTable.id }).from(summaryJobTable).where(buildCampaignWhereForPermission(userId, 'summary.run', summaryJobTable.campaignId)))), with: {
        summaryJob: true,
      } }).sync() ?? null)

    if (!suggestion) return null
    if (suggestion.status !== 'PENDING') {
      return {
        suggestionId: suggestion.id,
        status: suggestion.status === 'DISCARDED' ? 'DISCARDED' : 'APPLIED',
        entityType: suggestion.entityType,
      }
    }

    if (suggestion.action === 'DISCARD') {
      db.update(summarySuggestionTable).set({ status: 'DISCARDED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
      }

      return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
    }

    const originalPayload = suggestion.payload as Record<string, unknown>
    const payload = payloadOverride || originalPayload
    const match = (suggestion.match || {}) as Record<string, unknown>

    if (suggestion.entityType === 'SESSION') {
      if (suggestion.action !== 'UPDATE') {
        db.update(summarySuggestionTable).set({ status: 'DISCARDED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
        }

        return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
      }

      const changes = {
        title: typeof payload.title === 'string' ? payload.title : undefined,
        notes: typeof payload.notes === 'string' ? payload.notes : undefined,
      }
      const updated = Object.values(changes).some(value => value !== undefined)
        ? db.update(sessionTable).set(changes).where(eq(sessionTable.id, suggestion.summaryJob.sessionId)).returning().get()
        : db.select().from(sessionTable).where(eq(sessionTable.id, suggestion.summaryJob.sessionId)).get()
      if (!updated) throw new Error('Session match not found for update')

      const sessionKeys: Array<'title' | 'notes'> = ['title', 'notes']
      const overrideSessionKeys = payloadOverride
        ? new Set(sessionKeys.filter((key) => key in payloadOverride))
        : new Set<'title' | 'notes'>()
      const remainingPayload = Object.fromEntries(
        Object.entries(originalPayload).filter(
          ([key]) => !overrideSessionKeys.has(key as 'title' | 'notes')
        )
      ) as Record<string, unknown>

      const hasRemainingSessionFields =
        typeof remainingPayload.title === 'string' || typeof remainingPayload.notes === 'string'

      db.update(summarySuggestionTable).set(payloadOverride && hasRemainingSessionFields
          ? {
              status: 'PENDING',
              payload: JSON.parse(JSON.stringify(remainingPayload)) as JsonValue,
            }
          : {
              status: 'APPLIED',
            }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

      if (!(payloadOverride && hasRemainingSessionFields)) {
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
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
      db.update(summarySuggestionTable).set({ payload: JSON.parse(JSON.stringify(payloadOverride)) as JsonValue }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!
    }

    if (suggestion.entityType === 'QUEST') {
      let questId = typeof match.id === 'string' ? match.id : undefined
      if (!questId && typeof match.title === 'string') {
        const existing = (db.query.quest.findFirst({ where: and(eq(questTable.title, match.title), eq(questTable.campaignId, suggestion.summaryJob.campaignId)) }).sync() ?? null)
        questId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!questId) throw new Error('Quest match not found for update')
        const changes = {
          title: payload.title as string | undefined,
          description: payload.description as string | undefined,
          type: normalizeQuestType(payload.type),
          status: payload.status as 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD' | undefined,
          progressNotes: payload.progressNotes as string | undefined,
        }
        const updated = Object.values(changes).some(value => value !== undefined)
          ? db.update(questTable).set(changes).where(eq(questTable.id, questId)).returning().get()
          : db.select().from(questTable).where(eq(questTable.id, questId)).get()
        if (!updated) throw new Error('Quest match not found for update')
        db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = (db.insert(questTable).values({
          campaignId: suggestion.summaryJob.campaignId,
          title: String(payload.title || 'New quest'),
          description: payload.description as string | undefined,
          type: normalizeQuestType(payload.type),
          status: payload.status as 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD' | undefined,
          progressNotes: payload.progressNotes as string | undefined,
        }).returning().get()!)

      db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
      }

      return { suggestionId: suggestion.id, status: 'APPLIED', entityId: created.id, entityType: suggestion.entityType }
    }

    if (suggestion.entityType === 'MILESTONE') {
      let milestoneId = typeof match.id === 'string' ? match.id : undefined
      if (!milestoneId && typeof match.title === 'string') {
        const existing = (db.query.milestone.findFirst({ where: and(eq(milestoneTable.title, match.title), eq(milestoneTable.campaignId, suggestion.summaryJob.campaignId)) }).sync() ?? null)
        milestoneId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!milestoneId) throw new Error('Milestone match not found for update')
        const updated = (db.update(milestoneTable).set({
            title: payload.title as string | undefined,
            description: payload.description as string | undefined,
            isComplete: payload.isComplete as boolean | undefined,
            completedAt: parseDate(payload.completedAt),
          }).where(eq(milestoneTable.id, milestoneId)).returning().get()!)
        db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = (db.insert(milestoneTable).values({
          campaignId: suggestion.summaryJob.campaignId,
          title: String(payload.title || 'New milestone'),
          description: payload.description as string | undefined,
          isComplete: payload.isComplete as boolean | undefined,
          completedAt: parseDate(payload.completedAt),
        }).returning().get()!)

      db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
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
        const existing = (db.query.glossaryEntry.findFirst({ where: and(eq(glossaryEntryTable.name, match.name), eq(glossaryEntryTable.campaignId, suggestion.summaryJob.campaignId)) }).sync() ?? null)
        entryId = existing?.id
      }

      if (suggestion.action === 'UPDATE') {
        if (!entryId) throw new Error('Glossary match not found for update')
        const updated = (db.update(glossaryEntryTable).set({
            type,
            name: payload.name as string | undefined,
            description: payload.description as string | undefined,
            aliases: normalizeAliases(payload.aliases) || undefined,
          }).where(eq(glossaryEntryTable.id, entryId)).returning().get()!)
        await ensureGlossarySessionLink(updated.id, suggestion.summaryJob.sessionId)
        db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!
        if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
          db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
        }
        return { suggestionId: suggestion.id, status: 'APPLIED', entityId: updated.id, entityType: suggestion.entityType }
      }

      const created = (db.insert(glossaryEntryTable).values({
          campaignId: suggestion.summaryJob.campaignId,
          type,
          name: String(payload.name || 'Unnamed entry'),
          description: String(payload.description || ''),
          aliases: normalizeAliases(payload.aliases) || undefined,
        }).returning().get()!)
      await ensureGlossarySessionLink(created.id, suggestion.summaryJob.sessionId)

      db.update(summarySuggestionTable).set({ status: 'APPLIED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

      if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
        db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
      }

      return { suggestionId: suggestion.id, status: 'APPLIED', entityId: created.id, entityType: suggestion.entityType }
    }

    return null
  }

  async discardSuggestion(userId: string, suggestionId: string): Promise<ApplyResult | null> {
    const suggestion = (db.query.summarySuggestion.findFirst({ where: and(eq(summarySuggestionTable.id, suggestionId), inArray(summarySuggestionTable.summaryJobId, db.select({ id: summaryJobTable.id }).from(summaryJobTable).where(buildCampaignWhereForPermission(userId, 'summary.run', summaryJobTable.campaignId)))) }).sync() ?? null)

    if (!suggestion) return null

    db.update(summarySuggestionTable).set({ status: 'DISCARDED' }).where(eq(summarySuggestionTable.id, suggestion.id)).returning().get()!

    if (!(await hasPendingSuggestions(suggestion.summaryJobId))) {
      db.update(summaryJobTable).set({ status: 'APPLIED' }).where(eq(summaryJobTable.id, suggestion.summaryJobId)).returning().get()!
    }

    return { suggestionId: suggestion.id, status: 'DISCARDED', entityType: suggestion.entityType }
  }
}

