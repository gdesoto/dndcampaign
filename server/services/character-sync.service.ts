import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { GlossaryEntry } from '#server/db/schema'
import { computeCharacterSummary } from './character.service'

const buildGlossaryDescription = (sheetJson: Record<string, unknown>) => {
  const notes = (sheetJson.notes as Record<string, unknown> | undefined) || {}
  const backstory = typeof notes.backstory === 'string' ? notes.backstory.trim() : ''
  const other = typeof notes.other === 'string' ? notes.other.trim() : ''
  if (backstory && other) return `${backstory}\n\n${other}`
  if (backstory) return backstory
  if (other) return other
  return ''
}

const buildNotesFromGlossary = (description?: string | null) => {
  const text = (description || '').trim()
  if (!text) return {}
  return { other: text }
}

export class CharacterSyncService {
  async linkGlossaryPc(params: {
    ownerId: string
    entry: Pick<GlossaryEntry, 'id' | 'campaignId' | 'name' | 'description'>
  }) {
    const existingCharacter = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.ownerId, params.ownerId),
        eq(tables.playerCharacter.name, params.entry.name),
      ),
    })
    const sheetJson = {
      basics: { name: params.entry.name },
      notes: { other: params.entry.description },
    }
    const character =
      existingCharacter ||
      (await db.insert(tables.playerCharacter).values({
        ownerId: params.ownerId,
        name: params.entry.name,
        sheetJson: sheetJson as JsonValue,
        summaryJson: computeCharacterSummary(params.entry.name, sheetJson) as JsonValue,
      }).returning().get())

    const link = await db.insert(tables.campaignCharacter).values({
      campaignId: params.entry.campaignId,
      characterId: character.id,
      glossaryEntryId: params.entry.id,
    }).onConflictDoUpdate({ target: [tables.campaignCharacter.campaignId, tables.campaignCharacter.characterId], set: { glossaryEntryId: params.entry.id } }).returning().get()

    return { character, link }
  }

  async ensureGlossaryEntryForCharacter(params: {
    ownerId: string
    campaignId: string
    characterId: string
  }) {
    const character = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.id, params.characterId),
        eq(tables.playerCharacter.ownerId, params.ownerId),
      ),
    })
    if (!character) return null

    const existingLink = await db.query.campaignCharacter.findFirst({
      where: and(
        eq(tables.campaignCharacter.campaignId, params.campaignId),
        eq(tables.campaignCharacter.characterId, params.characterId),
      ),
    })

    if (existingLink?.glossaryEntryId) {
      return existingLink
    }

    const description = buildGlossaryDescription(character.sheetJson as Record<string, unknown>)
    const existingEntry = await db.query.glossaryEntry.findFirst({
      where: and(
        eq(tables.glossaryEntry.campaignId, params.campaignId),
        eq(tables.glossaryEntry.type, 'PC'),
        eq(tables.glossaryEntry.name, character.name),
      ),
    })
    const glossaryEntry =
      existingEntry ||
      (await db.insert(tables.glossaryEntry).values({
        campaignId: params.campaignId,
        type: 'PC',
        name: character.name,
        description: description || 'Player character',
      }).returning().get())

    if (existingLink) {
      return db.update(tables.campaignCharacter).set({ glossaryEntryId: glossaryEntry.id }).where(eq(tables.campaignCharacter.id, existingLink.id)).returning().get()!
    }

    return db.insert(tables.campaignCharacter).values({
      campaignId: params.campaignId,
      characterId: params.characterId,
      glossaryEntryId: glossaryEntry.id,
    }).returning().get()
  }

  async syncGlossaryForCharacter(characterId: string, ownerId: string) {
    const character = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.id, characterId),
        eq(tables.playerCharacter.ownerId, ownerId),
      ),
      with: {
        campaignLinks: true,
      },
    })
    if (!character) return

    const description = buildGlossaryDescription(character.sheetJson as Record<string, unknown>)
    const links = character.campaignLinks.filter((link) => Boolean(link.glossaryEntryId))
    if (links.length) {
      db.transaction((tx) => {
        for (const link of links) {
          tx.update(tables.glossaryEntry).set({
            name: character.name,
            description: description || undefined,
          }).where(eq(tables.glossaryEntry.id, link.glossaryEntryId!)).run()
        }
      }, { behavior: 'immediate' })
    }
  }

  async syncCharacterFromGlossary(entryId: string, ownerId: string) {
    const link = await db.query.campaignCharacter.findFirst({
      where: and(
        eq(tables.campaignCharacter.glossaryEntryId, entryId),
        inArray(tables.campaignCharacter.campaignId, db.select({ id: tables.campaign.id }).from(tables.campaign).where(eq(tables.campaign.ownerId, ownerId))),
      ),
      with: {
        character: true,
      },
    })
    if (!link) return null

    const entry = await db.query.glossaryEntry.findFirst({
      where: and(
        eq(tables.glossaryEntry.id, entryId),
        inArray(tables.glossaryEntry.campaignId, db.select({ id: tables.campaign.id }).from(tables.campaign).where(eq(tables.campaign.ownerId, ownerId))),
      ),
    })
    if (!entry) return null

    const sheetJson = (link.character.sheetJson as Record<string, unknown>) || {}
    const notes = buildNotesFromGlossary(entry.description)
    if (Object.keys(notes).length) {
      sheetJson.notes = { ...(sheetJson.notes as Record<string, unknown> | undefined), ...notes }
    }

    const summary = computeCharacterSummary(entry.name, sheetJson, link.character.portraitUrl)

    return db.update(tables.playerCharacter).set({
      name: entry.name,
      sheetJson: sheetJson as JsonValue,
      summaryJson: summary as JsonValue,
    }).where(eq(tables.playerCharacter.id, link.characterId)).returning().get()!
  }
}

