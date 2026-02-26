import { randomBytes } from 'node:crypto'
import { Prisma } from '#server/db/prisma-client'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import { defaultMapLayerTypes, type MapFeatureType } from '#shared/schemas/map'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type {
  CampaignPublicAccessOwnerDto,
  CampaignPublicAccessSection,
  CampaignPublicAccessUpdateInput,
  CampaignPublicOverviewDto,
  PublicCampaignDirectoryItem,
} from '#shared/schemas/campaign-public-access'
import type { PublicCampaignJournalListQueryInput } from '#shared/schemas/campaign-journal'
import {
  campaignJournalListDefaultPage,
  campaignJournalListDefaultPageSize,
} from '#shared/schemas/campaign-journal'
import { normalizeJournalTagLabel } from '#shared/utils/campaign-journal-tags'
import type { CampaignJournalListResponse } from '#shared/types/campaign-journal'
import { ActivityLogService } from '#server/services/activity-log.service'

const PUBLIC_SLUG_BYTE_LENGTH = 16
const activityLogService = new ActivityLogService()

type CampaignPublicAccessRecord = {
  campaignId: string
  isEnabled: boolean
  isListed: boolean
  publicSlug: string
  showCharacters: boolean
  showRecaps: boolean
  showSessions: boolean
  showGlossary: boolean
  showQuests: boolean
  showMilestones: boolean
  showMaps: boolean
  showJournal: boolean
  updatedAt: Date
}

type PublicResolverResult =
  | {
      ok: true
      campaignId: string
      access: CampaignPublicAccessRecord
      campaign: {
        name: string
        system: string
        description: string | null
        dungeonMasterName: string | null
      }
    }
  | {
      ok: false
      statusCode: number
      code: string
      message: string
    }

const sectionToFlag: Record<CampaignPublicAccessSection, keyof CampaignPublicAccessRecord> = {
  characters: 'showCharacters',
  recaps: 'showRecaps',
  sessions: 'showSessions',
  glossary: 'showGlossary',
  quests: 'showQuests',
  milestones: 'showMilestones',
  maps: 'showMaps',
  journal: 'showJournal',
}

const toOwnerDto = (record: CampaignPublicAccessRecord): CampaignPublicAccessOwnerDto => ({
  campaignId: record.campaignId,
  isEnabled: record.isEnabled,
  isListed: record.isListed,
  publicSlug: record.publicSlug,
  publicUrl: getPublicUrl(record.publicSlug),
  showCharacters: record.showCharacters,
  showRecaps: record.showRecaps,
  showSessions: record.showSessions,
  showGlossary: record.showGlossary,
  showQuests: record.showQuests,
  showMilestones: record.showMilestones,
  showMaps: record.showMaps,
  showJournal: record.showJournal,
  updatedAt: record.updatedAt.toISOString(),
})

const toDirectoryItem = (entry: {
  publicSlug: string
  updatedAt: Date
  campaign: {
    name: string
    system: string
    description: string | null
    dungeonMasterName: string | null
  }
}): PublicCampaignDirectoryItem => ({
  publicSlug: entry.publicSlug,
  publicUrl: getPublicUrl(entry.publicSlug),
  name: entry.campaign.name,
  system: entry.campaign.system,
  description: entry.campaign.description,
  dungeonMasterName: entry.campaign.dungeonMasterName,
  updatedAt: entry.updatedAt.toISOString(),
})

const getPublicUrl = (slug: string) => {
  const config = useRuntimeConfig()
  const appUrl = (config.public.appUrl || '').trim()
  const path = `/public/${slug}`

  if (!appUrl) {
    return path
  }

  return `${appUrl.replace(/\/$/, '')}${path}`
}

const buildSlug = () => randomBytes(PUBLIC_SLUG_BYTE_LENGTH).toString('hex')

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

const mapFeatureTypeToApi: Record<
  'STATE' | 'PROVINCE' | 'BURG' | 'MARKER' | 'RIVER' | 'ROUTE' | 'CELL',
  MapFeatureType
> = {
  STATE: 'state',
  PROVINCE: 'province',
  BURG: 'burg',
  MARKER: 'marker',
  RIVER: 'river',
  ROUTE: 'route',
  CELL: 'cell',
}

const parseMapCoordinates = (
  value: unknown
):
  | {
      latT: number
      latN: number
      latS: number
      lonT: number
      lonW: number
      lonE: number
    }
  | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entry = value as Record<string, unknown>
  const latT = typeof entry.latT === 'number' && Number.isFinite(entry.latT) ? entry.latT : null
  const latN = typeof entry.latN === 'number' && Number.isFinite(entry.latN) ? entry.latN : null
  const latS = typeof entry.latS === 'number' && Number.isFinite(entry.latS) ? entry.latS : null
  const lonT = typeof entry.lonT === 'number' && Number.isFinite(entry.lonT) ? entry.lonT : null
  const lonW = typeof entry.lonW === 'number' && Number.isFinite(entry.lonW) ? entry.lonW : null
  const lonE = typeof entry.lonE === 'number' && Number.isFinite(entry.lonE) ? entry.lonE : null
  if (
    latT === null ||
    latN === null ||
    latS === null ||
    lonT === null ||
    lonW === null ||
    lonE === null
  ) {
    return undefined
  }
  return { latT, latN, latS, lonT, lonW, lonE }
}

const createAccessRecord = async (
  campaignId: string,
  updatedByUserId: string,
  patch: Partial<CampaignPublicAccessUpdateInput> = {}
): Promise<CampaignPublicAccessRecord> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.campaignPublicAccess.create({
        data: {
          campaignId,
          updatedByUserId,
          publicSlug: buildSlug(),
          ...patch,
        },
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error
      }
    }
  }

  throw new Error('Unable to generate a unique public campaign slug.')
}

export class CampaignPublicAccessService {
  async getOwnerSettings(
    campaignId: string,
    updatedByUserId: string
  ): Promise<ServiceResult<CampaignPublicAccessOwnerDto>> {
    const existing = await prisma.campaignPublicAccess.findUnique({
      where: { campaignId },
    })

    if (existing) {
      return { ok: true, data: toOwnerDto(existing) }
    }

    const created = await createAccessRecord(campaignId, updatedByUserId)
    return { ok: true, data: toOwnerDto(created) }
  }

  async updateOwnerSettings(
    campaignId: string,
    updatedByUserId: string,
    input: CampaignPublicAccessUpdateInput
  ): Promise<ServiceResult<CampaignPublicAccessOwnerDto>> {
    const normalizedInput: CampaignPublicAccessUpdateInput = { ...input }
    if (normalizedInput.isEnabled === false) {
      normalizedInput.isListed = false
    }

    const existing = await prisma.campaignPublicAccess.findUnique({
      where: { campaignId },
    })

    const updated = existing
      ? await prisma.campaignPublicAccess.update({
          where: { campaignId },
          data: {
            ...normalizedInput,
            updatedByUserId,
          },
        })
      : await createAccessRecord(campaignId, updatedByUserId, normalizedInput)

    await activityLogService.log({
      actorUserId: updatedByUserId,
      campaignId,
      scope: 'CAMPAIGN',
      action: 'CAMPAIGN_PUBLIC_ACCESS_UPDATED',
      targetType: 'CAMPAIGN_PUBLIC_ACCESS',
      targetId: campaignId,
      summary: 'Updated public campaign access settings.',
      metadata: {
        previous: existing
          ? {
              isEnabled: existing.isEnabled,
              isListed: existing.isListed,
              showCharacters: existing.showCharacters,
              showRecaps: existing.showRecaps,
              showSessions: existing.showSessions,
              showGlossary: existing.showGlossary,
              showQuests: existing.showQuests,
              showMilestones: existing.showMilestones,
              showMaps: existing.showMaps,
              showJournal: existing.showJournal,
              publicSlug: existing.publicSlug,
            }
          : null,
        next: {
          isEnabled: updated.isEnabled,
          isListed: updated.isListed,
          showCharacters: updated.showCharacters,
          showRecaps: updated.showRecaps,
          showSessions: updated.showSessions,
          showGlossary: updated.showGlossary,
          showQuests: updated.showQuests,
          showMilestones: updated.showMilestones,
          showMaps: updated.showMaps,
          showJournal: updated.showJournal,
          publicSlug: updated.publicSlug,
        },
      },
    })

    return { ok: true, data: toOwnerDto(updated) }
  }

  async regenerateSlug(
    campaignId: string,
    updatedByUserId: string
  ): Promise<ServiceResult<CampaignPublicAccessOwnerDto>> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const existing = await prisma.campaignPublicAccess.findUnique({
          where: { campaignId },
        })
        const nextSlug = buildSlug()
        const updated = existing
          ? await prisma.campaignPublicAccess.update({
              where: { campaignId },
              data: {
                publicSlug: nextSlug,
                updatedByUserId,
              },
            })
          : await prisma.campaignPublicAccess.create({
              data: {
                campaignId,
                publicSlug: nextSlug,
                updatedByUserId,
              },
            })

        await activityLogService.log({
          actorUserId: updatedByUserId,
          campaignId,
          scope: 'CAMPAIGN',
          action: 'CAMPAIGN_PUBLIC_SLUG_REGENERATED',
          targetType: 'CAMPAIGN_PUBLIC_ACCESS',
          targetId: campaignId,
          summary: 'Regenerated campaign public slug.',
          metadata: {
            previousPublicSlug: existing?.publicSlug || null,
            nextPublicSlug: updated.publicSlug,
          },
        })

        return { ok: true, data: toOwnerDto(updated) }
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }
    }

    return {
      ok: false,
      statusCode: 500,
      code: 'PUBLIC_SLUG_GENERATION_FAILED',
      message: 'Unable to regenerate a unique public URL. Try again.',
    }
  }

  private async resolvePublicAccess(
    publicSlug: string,
    section?: CampaignPublicAccessSection
  ): Promise<PublicResolverResult> {
    const access = await prisma.campaignPublicAccess.findUnique({
      where: { publicSlug },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            system: true,
            description: true,
            dungeonMasterName: true,
          },
        },
      },
    })

    if (!access || !access.isEnabled) {
      return {
        ok: false,
        statusCode: 404,
        code: 'PUBLIC_CAMPAIGN_NOT_FOUND',
        message: 'Public campaign not found.',
      }
    }

    if (section) {
      const flag = sectionToFlag[section]
      if (!access[flag]) {
        return {
          ok: false,
          statusCode: 404,
          code: 'PUBLIC_SECTION_NOT_AVAILABLE',
          message: 'This public section is not available.',
        }
      }
    }

    return {
      ok: true,
      campaignId: access.campaign.id,
      access,
      campaign: {
        name: access.campaign.name,
        system: access.campaign.system,
        description: access.campaign.description,
        dungeonMasterName: access.campaign.dungeonMasterName,
      },
    }
  }

  async getPublicOverview(publicSlug: string): Promise<ServiceResult<CampaignPublicOverviewDto>> {
    const resolved = await this.resolvePublicAccess(publicSlug)
    if (!resolved.ok) {
      return resolved
    }

    return {
      ok: true,
      data: {
        campaign: resolved.campaign,
        sections: {
          showCharacters: resolved.access.showCharacters,
          showRecaps: resolved.access.showRecaps,
          showSessions: resolved.access.showSessions,
          showGlossary: resolved.access.showGlossary,
          showQuests: resolved.access.showQuests,
          showMilestones: resolved.access.showMilestones,
          showMaps: resolved.access.showMaps,
          showJournal: resolved.access.showJournal,
        },
      },
    }
  }

  async getPublicJournalEntries(
    publicSlug: string,
    query: PublicCampaignJournalListQueryInput
  ): Promise<ServiceResult<CampaignJournalListResponse>> {
    const resolved = await this.resolvePublicAccess(publicSlug, 'journal')
    if (!resolved.ok) return resolved

    const page = query.page || campaignJournalListDefaultPage
    const pageSize = query.pageSize || campaignJournalListDefaultPageSize
    const normalizedTag = query.tag ? normalizeJournalTagLabel(query.tag) : undefined

    const where: Prisma.CampaignJournalEntryWhereInput = {
      campaignId: resolved.campaignId,
      visibility: 'CAMPAIGN',
      ...(query.sessionId
        ? {
            sessionLinks: {
              some: {
                sessionId: query.sessionId,
              },
            },
          }
        : {}),
      ...(normalizedTag
        ? {
            tags: {
              some: {
                normalizedLabel: normalizedTag,
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { contentMarkdown: { contains: query.search } },
              { tags: { some: { displayLabel: { contains: query.search } } } },
            ],
          }
        : {}),
    }

    const [total, rows] = await prisma.$transaction([
      prisma.campaignJournalEntry.count({ where }),
      prisma.campaignJournalEntry.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          authorUser: {
            select: {
              id: true,
              name: true,
            },
          },
          tags: {
            include: {
              glossaryEntry: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ tagType: 'asc' }, { displayLabel: 'asc' }],
          },
          sessionLinks: {
            include: {
              session: {
                select: {
                  id: true,
                  title: true,
                  sessionNumber: true,
                },
              },
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
      }),
    ])

    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          campaignId: row.campaignId,
          authorUserId: row.authorUserId,
          authorName: row.authorUser.name,
          title: row.title,
          contentMarkdown: row.contentMarkdown,
          visibility: row.visibility,
          sessions: row.sessionLinks.map((link) => ({
            sessionId: link.session.id,
            title: link.session.title,
            sessionNumber: link.session.sessionNumber,
          })),
          tags: row.tags.map((tag) => {
            if (tag.tagType === 'CUSTOM') {
              return {
                id: tag.id,
                tagType: 'CUSTOM' as const,
                displayLabel: tag.displayLabel,
                normalizedLabel: tag.normalizedLabel,
                glossaryEntryId: null,
                glossaryEntryName: null,
                isOrphanedGlossaryTag: false as const,
              }
            }

            if (tag.glossaryEntryId && tag.glossaryEntry) {
              return {
                id: tag.id,
                tagType: 'GLOSSARY' as const,
                displayLabel: tag.displayLabel,
                normalizedLabel: tag.normalizedLabel,
                glossaryEntryId: tag.glossaryEntry.id,
                glossaryEntryName: tag.glossaryEntry.name,
                isOrphanedGlossaryTag: false as const,
              }
            }

            return {
              id: tag.id,
              tagType: 'GLOSSARY' as const,
              displayLabel: tag.displayLabel,
              normalizedLabel: tag.normalizedLabel,
              glossaryEntryId: null,
              glossaryEntryName: null,
              isOrphanedGlossaryTag: true as const,
            }
          }),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          canView: true,
          canEdit: false,
          canDelete: false,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    }
  }

  async listPublicCampaignDirectory(input: {
    limit?: number
    search?: string
    random?: boolean
  }) {
    const limit = Math.min(Math.max(input.limit || 24, 1), 100)
    const search = (input.search || '').trim()

    const rows = await prisma.campaignPublicAccess.findMany({
      where: {
        isEnabled: true,
        isListed: true,
        ...(search
          ? {
              campaign: {
                OR: [
                  { name: { contains: search } },
                  { description: { contains: search } },
                  { dungeonMasterName: { contains: search } },
                  { system: { contains: search } },
                ],
              },
            }
          : {}),
      },
      select: {
        publicSlug: true,
        updatedAt: true,
        campaign: {
          select: {
            name: true,
            system: true,
            description: true,
            dungeonMasterName: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: input.random ? 100 : limit,
    })

    const sorted = rows.map(toDirectoryItem)
    if (!input.random) {
      return { ok: true as const, data: sorted }
    }

    const shuffled = [...sorted]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i]!
      shuffled[i] = shuffled[j]!
      shuffled[j] = tmp
    }

    return { ok: true as const, data: shuffled.slice(0, limit) }
  }

  async getPublicCharacters(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'characters')
    if (!resolved.ok) return resolved

    const rows = await prisma.campaignCharacter.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        status: true,
        roleLabel: true,
        notes: true,
        character: {
          select: {
            name: true,
            status: true,
            portraitUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return {
      ok: true as const,
      data: rows.map((row) => ({
        name: row.character.name,
        status: row.character.status,
        portraitUrl: row.character.portraitUrl,
        campaignStatus: row.status,
        roleLabel: row.roleLabel,
        notes: row.notes,
      })),
    }
  }

  async getPublicRecaps(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'recaps')
    if (!resolved.ok) return resolved

    const rows = await prisma.recapRecording.findMany({
      where: { session: { campaignId: resolved.campaignId } },
      select: {
        id: true,
        filename: true,
        durationSeconds: true,
        createdAt: true,
        session: {
          select: {
            id: true,
            title: true,
            sessionNumber: true,
            playedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { ok: true as const, data: rows }
  }

  async getPublicRecapPlayback(publicSlug: string, recapId: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'recaps')
    if (!resolved.ok) return resolved

    const recap = await prisma.recapRecording.findFirst({
      where: {
        id: recapId,
        session: {
          campaignId: resolved.campaignId,
        },
      },
      select: { id: true },
    })
    if (!recap) {
      return {
        ok: false as const,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Recap not found.',
      }
    }

    return {
      ok: true as const,
      data: {
        url: `/api/public/campaigns/${publicSlug}/recaps/${recapId}/stream`,
      },
    }
  }

  async getPublicRecapStream(publicSlug: string, recapId: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'recaps')
    if (!resolved.ok) return resolved

    const recap = await prisma.recapRecording.findFirst({
      where: {
        id: recapId,
        session: {
          campaignId: resolved.campaignId,
        },
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        artifact: {
          select: {
            storageKey: true,
          },
        },
      },
    })

    if (!recap) {
      return {
        ok: false as const,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Recap not found.',
      }
    }

    const adapter = getStorageAdapter()
    const stream = await adapter.getObject(recap.artifact.storageKey)
    return {
      ok: true as const,
      data: {
        contentType: recap.mimeType,
        filename: recap.filename,
        stream,
      },
    }
  }

  async getPublicSessions(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'sessions')
    if (!resolved.ok) return resolved

    const rows = await prisma.session.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        title: true,
        sessionNumber: true,
        playedAt: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ sessionNumber: 'asc' }, { playedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return { ok: true as const, data: rows }
  }

  async getPublicGlossary(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'glossary')
    if (!resolved.ok) return resolved

    const rows = await prisma.glossaryEntry.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        type: true,
        name: true,
        aliases: true,
        description: true,
        sessions: {
          select: {
            session: {
              select: {
                title: true,
                sessionNumber: true,
                playedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { ok: true as const, data: rows }
  }

  async getPublicQuests(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'quests')
    if (!resolved.ok) return resolved

    const rows = await prisma.quest.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        title: true,
        description: true,
        type: true,
        status: true,
        progressNotes: true,
        sortOrder: true,
        createdAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return { ok: true as const, data: rows }
  }

  async getPublicMilestones(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'milestones')
    if (!resolved.ok) return resolved

    const rows = await prisma.milestone.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        title: true,
        description: true,
        isComplete: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: [{ isComplete: 'asc' }, { createdAt: 'desc' }],
    })

    return { ok: true as const, data: rows }
  }

  async getPublicMaps(publicSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'maps')
    if (!resolved.ok) return resolved

    const rows = await prisma.campaignMap.findMany({
      where: { campaignId: resolved.campaignId },
      select: {
        name: true,
        slug: true,
        isPrimary: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })

    return { ok: true as const, data: rows }
  }

  async getPublicMapViewer(publicSlug: string, mapSlug?: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'maps')
    if (!resolved.ok) return resolved

    const map = await prisma.campaignMap.findFirst({
      where: {
        campaignId: resolved.campaignId,
        ...(mapSlug ? { slug: mapSlug } : { isPrimary: true }),
      },
      select: {
        id: true,
        campaignId: true,
        name: true,
        isPrimary: true,
        status: true,
        importVersion: true,
        sourceFingerprint: true,
        rawManifestJson: true,
      },
      orderBy: mapSlug ? undefined : [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })

    if (!map) {
      return {
        ok: false as const,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Map not found.',
      }
    }

    const features = await prisma.campaignMapFeature.findMany({
      where: { campaignMapId: map.id },
      orderBy: [{ featureType: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        geometryJson: true,
        propertiesJson: true,
        displayName: true,
        description: true,
        externalId: true,
        removed: true,
        sourceRef: true,
        featureType: true,
      },
    })

    const manifest = (map.rawManifestJson || {}) as Record<string, unknown>
    const bounds =
      Array.isArray(manifest.bounds) && manifest.bounds.length === 2
        ? (manifest.bounds as [[number, number], [number, number]])
        : [[-180, -85], [180, 85]]
    const mapCoordinates = parseMapCoordinates(manifest.mapCoordinates)

    return {
      ok: true as const,
      data: {
        map: {
          id: map.id,
          campaignId: map.campaignId,
          name: map.name,
          isPrimary: map.isPrimary,
          status: map.status,
          importVersion: map.importVersion,
          sourceFingerprint: map.sourceFingerprint,
          bounds,
          mapCoordinates,
          defaultActiveLayers: [...defaultMapLayerTypes],
        },
        features: features.map((feature) => ({
          id: feature.id,
          type: 'Feature' as const,
          geometry: feature.geometryJson as { type: string; coordinates: unknown },
          properties: {
            mapFeatureId: feature.id,
            featureType: mapFeatureTypeToApi[feature.featureType],
            displayName: feature.displayName,
            description: feature.description,
            externalId: feature.externalId,
            removed: feature.removed,
            sourceRef: feature.sourceRef,
            glossaryLinked: false,
            glossaryMatched: false,
            glossaryLinkedOrMatched: false,
            ...(feature.propertiesJson as Record<string, unknown> | null | undefined),
          },
        })),
      },
    }
  }

  async getPublicMapSvg(publicSlug: string, mapSlug: string) {
    const resolved = await this.resolvePublicAccess(publicSlug, 'maps')
    if (!resolved.ok) return resolved

    const map = await prisma.campaignMap.findFirst({
      where: {
        campaignId: resolved.campaignId,
        slug: mapSlug,
      },
      select: {
        slug: true,
        files: {
          where: { kind: 'SVG' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            storageKey: true,
            contentType: true,
          },
        },
      },
    })

    if (!map) {
      return {
        ok: false as const,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Map not found.',
      }
    }

    const svgFile = map.files[0]
    if (!svgFile) {
      return {
        ok: false as const,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No SVG source file found for this map.',
      }
    }

    const adapter = getStorageAdapter()
    const stream = await adapter.getObject(svgFile.storageKey)
    return {
      ok: true as const,
      data: {
        contentType: svgFile.contentType || 'image/svg+xml',
        filename: `${map.slug || 'map'}.svg`,
        stream,
      },
    }
  }
}

