import type { Prisma } from '@prisma/client'
import { prisma } from '#server/db/prisma'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export type CharacterAccess = {
  exists: boolean
  canRead: boolean
  canEdit: boolean
  ownerId: string | null
}

export const buildCharacterReadWhere = (userId: string): Prisma.PlayerCharacterWhereInput => ({
  OR: [
    { ownerId: userId },
    {
      campaignLinks: {
        some: {
          campaign: buildCampaignWhereForPermission(userId, 'content.read'),
        },
      },
    },
  ],
})

export type CharacterUnlinkAccessImpact = {
  warningRequired: boolean
  impactedUserCount: number
}

const allCampaignRoles = ['OWNER', 'COLLABORATOR', 'VIEWER'] as const

export const calculateCharacterUnlinkAccessImpact = async (
  campaignId: string,
  characterId: string
): Promise<CharacterUnlinkAccessImpact> => {
  const character = await prisma.playerCharacter.findUnique({
    where: { id: characterId },
    select: { ownerId: true },
  })
  if (!character) {
    return { warningRequired: false, impactedUserCount: 0 }
  }

  const campaignMembers = await prisma.campaignMember.findMany({
    where: {
      campaignId,
      role: { in: [...allCampaignRoles] },
      userId: { not: character.ownerId },
    },
    select: { userId: true },
  })
  if (!campaignMembers.length) {
    return { warningRequired: false, impactedUserCount: 0 }
  }

  let impactedUserCount = 0

  for (const member of campaignMembers) {
    const hasAlternativeSharedAccess = await prisma.campaignCharacter.findFirst({
      where: {
        characterId,
        campaignId: { not: campaignId },
        campaign: buildCampaignWhereForPermission(member.userId, 'content.read'),
      },
      select: { id: true },
    })

    if (!hasAlternativeSharedAccess) {
      impactedUserCount += 1
    }
  }

  return {
    warningRequired: impactedUserCount > 0,
    impactedUserCount,
  }
}

export const resolveCharacterAccess = async (
  characterId: string,
  userId: string,
  systemRole?: 'USER' | 'SYSTEM_ADMIN'
): Promise<CharacterAccess> => {
  const character = await prisma.playerCharacter.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      ownerId: true,
      campaignLinks: {
        where: {
          campaign: buildCampaignWhereForPermission(userId, 'content.read'),
        },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!character) {
    return {
      exists: false,
      canRead: false,
      canEdit: false,
      ownerId: null,
    }
  }

  const isOwner = character.ownerId === userId
  const isSystemAdmin = systemRole === 'SYSTEM_ADMIN'
  const canRead = isOwner || isSystemAdmin || character.campaignLinks.length > 0
  const canEdit = isOwner

  return {
    exists: true,
    canRead,
    canEdit,
    ownerId: character.ownerId,
  }
}
