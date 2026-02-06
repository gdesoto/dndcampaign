import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { computeCharacterSummary } from '#server/services/character.service'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    return fail(403, 'FORBIDDEN', 'Migration endpoint is disabled in production.')
  }

  const session = await requireUserSession(event)
  const body = (await readBody(event)) as { campaignId?: string; deleteGlossary?: boolean }

  const campaigns = await prisma.campaign.findMany({
    where: {
      ownerId: session.user.id,
      id: body.campaignId || undefined,
    },
    select: { id: true },
  })

  if (!campaigns.length) {
    return fail(404, 'NOT_FOUND', 'No campaigns found')
  }

  const campaignIds = campaigns.map((campaign) => campaign.id)

  const glossaryEntries = await prisma.glossaryEntry.findMany({
    where: {
      campaignId: { in: campaignIds },
      type: 'PC',
    },
  })

  const results: Array<{ glossaryId: string; characterId: string }> = []

  for (const entry of glossaryEntries) {
    const sheetJson = {
      basics: { name: entry.name },
      notes: { other: entry.description },
    }
    const existing = await prisma.playerCharacter.findFirst({
      where: { ownerId: session.user.id, name: entry.name },
    })

    const character =
      existing ||
      (await prisma.playerCharacter.create({
        data: {
          ownerId: session.user.id,
          name: entry.name,
          sheetJson,
          summaryJson: computeCharacterSummary(entry.name, sheetJson),
        },
      }))

    await prisma.campaignCharacter.upsert({
      where: { campaignId_characterId: { campaignId: entry.campaignId, characterId: character.id } },
      update: { glossaryEntryId: entry.id },
      create: {
        campaignId: entry.campaignId,
        characterId: character.id,
        glossaryEntryId: entry.id,
      },
    })

    results.push({ glossaryId: entry.id, characterId: character.id })
  }

  if (body.deleteGlossary) {
    await prisma.glossaryEntry.deleteMany({
      where: { id: { in: glossaryEntries.map((entry) => entry.id) } },
    })
  }

  return ok({ migrated: results.length, results })
})
