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
  const canEdit = isOwner || isSystemAdmin

  return {
    exists: true,
    canRead,
    canEdit,
    ownerId: character.ownerId,
  }
}
