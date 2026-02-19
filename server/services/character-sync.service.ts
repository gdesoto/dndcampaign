import { prisma } from '#server/db/prisma'
import type { Prisma } from '@prisma/client'
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
  async ensureGlossaryEntryForCharacter(params: {
    ownerId: string
    campaignId: string
    characterId: string
  }) {
    const character = await prisma.playerCharacter.findFirst({
      where: { id: params.characterId, ownerId: params.ownerId },
    })
    if (!character) return null

    const existingLink = await prisma.campaignCharacter.findUnique({
      where: { campaignId_characterId: { campaignId: params.campaignId, characterId: params.characterId } },
    })

    if (existingLink?.glossaryEntryId) {
      return existingLink
    }

    const description = buildGlossaryDescription(character.sheetJson as Record<string, unknown>)
    const existingEntry = await prisma.glossaryEntry.findFirst({
      where: { campaignId: params.campaignId, type: 'PC', name: character.name },
    })
    const glossaryEntry =
      existingEntry ||
      (await prisma.glossaryEntry.create({
        data: {
          campaignId: params.campaignId,
          type: 'PC',
          name: character.name,
          description: description || 'Player character',
        },
      }))

    if (existingLink) {
      return prisma.campaignCharacter.update({
        where: { id: existingLink.id },
        data: { glossaryEntryId: glossaryEntry.id },
      })
    }

    return prisma.campaignCharacter.create({
      data: {
        campaignId: params.campaignId,
        characterId: params.characterId,
        glossaryEntryId: glossaryEntry.id,
      },
    })
  }

  async syncGlossaryForCharacter(characterId: string, ownerId: string) {
    const character = await prisma.playerCharacter.findFirst({
      where: { id: characterId, ownerId },
      include: { campaignLinks: true },
    })
    if (!character) return

    const description = buildGlossaryDescription(character.sheetJson as Record<string, unknown>)
    const updates = character.campaignLinks
      .filter((link) => Boolean(link.glossaryEntryId))
      .map((link) =>
        prisma.glossaryEntry.update({
          where: { id: link.glossaryEntryId! },
          data: {
            name: character.name,
            description: description || undefined,
          },
        })
      )

    if (updates.length) {
      await prisma.$transaction(updates)
    }
  }

  async syncCharacterFromGlossary(entryId: string, ownerId: string) {
    const link = await prisma.campaignCharacter.findFirst({
      where: { glossaryEntryId: entryId, campaign: { ownerId } },
      include: { character: true },
    })
    if (!link) return null

    const entry = await prisma.glossaryEntry.findFirst({
      where: { id: entryId, campaign: { ownerId } },
    })
    if (!entry) return null

    const sheetJson = (link.character.sheetJson as Record<string, unknown>) || {}
    const notes = buildNotesFromGlossary(entry.description)
    if (Object.keys(notes).length) {
      sheetJson.notes = { ...(sheetJson.notes as Record<string, unknown> | undefined), ...notes }
    }

    const summary = computeCharacterSummary(entry.name, sheetJson, link.character.portraitUrl)

    return prisma.playerCharacter.update({
      where: { id: link.characterId },
      data: {
        name: entry.name,
        sheetJson: sheetJson as Prisma.InputJsonValue,
        summaryJson: summary as Prisma.InputJsonValue,
      },
    })
  }
}
