import { and, eq, inArray, ne, or, type SQL } from 'drizzle-orm'
import { db } from '#server/db/client'
import { campaignCharacter, campaignMember, playerCharacter } from '#server/db/schema'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export type CharacterAccess = {
  exists: boolean
  canRead: boolean
  canEdit: boolean
  ownerId: string | null
}

export const buildCharacterReadWhere = (userId: string): SQL => or(
  eq(playerCharacter.ownerId, userId),
  inArray(playerCharacter.id, db.select({ characterId: campaignCharacter.characterId })
    .from(campaignCharacter)
    .where(buildCampaignWhereForPermission(userId, 'content.read', campaignCharacter.campaignId))),
)!

export type CharacterUnlinkAccessImpact = {
  warningRequired: boolean
  impactedUserCount: number
}

const allCampaignRoles = ['OWNER', 'COLLABORATOR', 'VIEWER'] as const

export const calculateCharacterUnlinkAccessImpact = async (
  campaignId: string,
  characterId: string,
): Promise<CharacterUnlinkAccessImpact> => {
  const character = await db.query.playerCharacter.findFirst({
    where: eq(playerCharacter.id, characterId),
    columns: { ownerId: true },
  })
  if (!character) return { warningRequired: false, impactedUserCount: 0 }

  const campaignMembers = await db.query.campaignMember.findMany({
    where: and(
      eq(campaignMember.campaignId, campaignId),
      inArray(campaignMember.role, [...allCampaignRoles]),
      ne(campaignMember.userId, character.ownerId),
    ),
    columns: { userId: true },
  })
  let impactedUserCount = 0
  for (const member of campaignMembers) {
    const alternative = await db.query.campaignCharacter.findFirst({
      where: and(
        eq(campaignCharacter.characterId, characterId),
        ne(campaignCharacter.campaignId, campaignId),
        buildCampaignWhereForPermission(member.userId, 'content.read', campaignCharacter.campaignId),
      ),
      columns: { id: true },
    })
    if (!alternative) impactedUserCount += 1
  }
  return { warningRequired: impactedUserCount > 0, impactedUserCount }
}

export const resolveCharacterAccess = async (
  characterId: string,
  userId: string,
  systemRole?: 'USER' | 'SYSTEM_ADMIN',
): Promise<CharacterAccess> => {
  const character = await db.query.playerCharacter.findFirst({
    where: eq(playerCharacter.id, characterId),
    columns: { id: true, ownerId: true },
    with: {
      campaignLinks: {
        where: buildCampaignWhereForPermission(userId, 'content.read', campaignCharacter.campaignId),
        columns: { id: true },
        limit: 1,
      },
    },
  })
  if (!character) return { exists: false, canRead: false, canEdit: false, ownerId: null }
  const isOwner = character.ownerId === userId
  return {
    exists: true,
    canRead: isOwner || systemRole === 'SYSTEM_ADMIN' || character.campaignLinks.length > 0,
    canEdit: isOwner,
    ownerId: character.ownerId,
  }
}
