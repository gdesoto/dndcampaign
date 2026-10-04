import { getMediaStream } from '#server/utils/media-stream'
import { randomBytes } from 'node:crypto'
import type { CampaignPublicAccess } from '#server/db/schema'
import { isSqliteUniqueConstraintError } from '#server/db/errors'
import { db } from '#server/db/client'
import { asc,desc,and,or,eq,inArray,like,count } from 'drizzle-orm'
import { campaignJournalTag,campaignJournalEntrySessionLink,campaignPublicAccess,campaignJournalEntry,campaign,campaignCharacter,recapRecording,session,glossaryEntry,quest,milestone,campaignMap,campaignMapFeature,campaignMapFile } from '#server/db/schema'
import { defaultMapLayerTypes,type MapFeatureType } from '#shared/schemas/map'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type { CampaignPublicAccessOwnerDto,CampaignPublicAccessSection,CampaignPublicAccessUpdateInput,CampaignPublicOverviewDto,PublicCampaignDirectoryItem,} from '#shared/schemas/campaign-public-access'
import type { PublicCampaignJournalListQueryInput } from '#shared/schemas/campaign-journal'
import { campaignJournalListDefaultPage,campaignJournalListDefaultPageSize,} from '#shared/schemas/campaign-journal'
import { normalizeJournalTagLabel } from '#shared/utils/campaign-journal-tags'
import type { CampaignJournalListResponse } from '#shared/types/campaign-journal'
import { ActivityLogService } from '#server/services/activity-log.service'
import { apiError } from '#server/utils/http'
const PUBLIC_SLUG_BYTE_LENGTH=16
const activityLogService=new ActivityLogService()
type CampaignPublicAccessRecord=Pick<CampaignPublicAccess,'campaignId'|'isEnabled'|'isListed'|'publicSlug'|'showCharacters'|'showRecaps'|'showSessions'|'showGlossary'|'showQuests'|'showMilestones'|'showMaps'|'showJournal'|'updatedAt'>
type PublicResolverResult={
  campaignId: string
  access: CampaignPublicAccessRecord
  campaign: {
    name: string
    system: string
    description: string|null
    dungeonMasterName: string|null
  }
}
const sectionToFlag: Record<CampaignPublicAccessSection,keyof CampaignPublicAccessRecord>={
  characters: 'showCharacters',
  recaps: 'showRecaps',
  sessions: 'showSessions',
  glossary: 'showGlossary',
  quests: 'showQuests',
  milestones: 'showMilestones',
  maps: 'showMaps',
  journal: 'showJournal',
}
const toOwnerDto=(record: CampaignPublicAccessRecord): CampaignPublicAccessOwnerDto => ({
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
const toDirectoryItem=(entry: {
  publicSlug: string
  updatedAt: Date
  campaign: {
    name: string
    system: string
    description: string|null
    dungeonMasterName: string|null
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
const getPublicUrl=(slug: string) => {
  const config=useRuntimeConfig()
  const appUrl=(config.public.appUrl||'').trim()
  const path=`/public/${slug}`
  if(!appUrl) {
    return path
  }
  return `${appUrl.replace(/\/$/,'')}${path}`
}
const buildSlug=() => randomBytes(PUBLIC_SLUG_BYTE_LENGTH).toString('hex')
const isUniqueConstraintError=isSqliteUniqueConstraintError
const mapFeatureTypeToApi: Record<'STATE'|'PROVINCE'|'BURG'|'MARKER'|'RIVER'|'ROUTE'|'CELL',MapFeatureType>={
  STATE: 'state',
  PROVINCE: 'province',
  BURG: 'burg',
  MARKER: 'marker',
  RIVER: 'river',
  ROUTE: 'route',
  CELL: 'cell',
}
const parseMapCoordinates=(value: unknown): {
  latT: number
  latN: number
  latS: number
  lonT: number
  lonW: number
  lonE: number
}|undefined => {
  if(!value||typeof value!=='object'||Array.isArray(value))
    return undefined
  const entry=value as Record<string,unknown>
  const latT=typeof entry.latT==='number'&&Number.isFinite(entry.latT)? entry.latT:null
  const latN=typeof entry.latN==='number'&&Number.isFinite(entry.latN)? entry.latN:null
  const latS=typeof entry.latS==='number'&&Number.isFinite(entry.latS)? entry.latS:null
  const lonT=typeof entry.lonT==='number'&&Number.isFinite(entry.lonT)? entry.lonT:null
  const lonW=typeof entry.lonW==='number'&&Number.isFinite(entry.lonW)? entry.lonW:null
  const lonE=typeof entry.lonE==='number'&&Number.isFinite(entry.lonE)? entry.lonE:null
  if(latT===null||
    latN===null||
    latS===null||
    lonT===null||
    lonW===null||
    lonE===null) {
    return undefined
  }
  return { latT,latN,latS,lonT,lonW,lonE }
}
const createAccessRecord=async (campaignId: string,updatedByUserId: string,patch: Partial<CampaignPublicAccessUpdateInput>={}): Promise<CampaignPublicAccessRecord> => {
  for(let attempt=0;attempt<5;attempt+=1) {
    try {
      return db.insert(campaignPublicAccess).values({
        campaignId,
        updatedByUserId,
        publicSlug: buildSlug(),
        ...patch,
      }).returning().get()
    }
    catch(error) {
      if(!isUniqueConstraintError(error)) {
        throw error
      }
    }
  }
  throw new Error('Unable to generate a unique public campaign slug.')
}
export class CampaignPublicAccessService {
  async getOwnerSettings(campaignId: string,updatedByUserId: string): Promise<CampaignPublicAccessOwnerDto> {
    const existing=db.query.campaignPublicAccess.findFirst({ where: eq(campaignPublicAccess.campaignId,campaignId) }).sync()
    if(existing) {
      return toOwnerDto(existing)
    }
    const created=await createAccessRecord(campaignId,updatedByUserId)
    return toOwnerDto(created)
  }
  async updateOwnerSettings(campaignId: string,updatedByUserId: string,input: CampaignPublicAccessUpdateInput): Promise<CampaignPublicAccessOwnerDto> {
    const normalizedInput: CampaignPublicAccessUpdateInput={ ...input }
    if(normalizedInput.isEnabled===false) {
      normalizedInput.isListed=false
    }
    const existing=db.query.campaignPublicAccess.findFirst({ where: eq(campaignPublicAccess.campaignId,campaignId) }).sync()
    const updated=existing
      ? db.update(campaignPublicAccess).set({
        ...normalizedInput,
        updatedByUserId,
      }).where(eq(campaignPublicAccess.campaignId,campaignId)).returning().get()!
      :await createAccessRecord(campaignId,updatedByUserId,normalizedInput)
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
          :null,
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
    return toOwnerDto(updated)
  }
  async regenerateSlug(campaignId: string,updatedByUserId: string): Promise<CampaignPublicAccessOwnerDto> {
    for(let attempt=0;attempt<5;attempt+=1) {
      try {
        const existing=db.query.campaignPublicAccess.findFirst({ where: eq(campaignPublicAccess.campaignId,campaignId) }).sync()
        const nextSlug=buildSlug()
        const updated=existing
          ? db.update(campaignPublicAccess).set({
            publicSlug: nextSlug,
            updatedByUserId,
          }).where(eq(campaignPublicAccess.campaignId,campaignId)).returning().get()!
          :db.insert(campaignPublicAccess).values({
            campaignId,
            publicSlug: nextSlug,
            updatedByUserId,
          }).returning().get()
        await activityLogService.log({
          actorUserId: updatedByUserId,
          campaignId,
          scope: 'CAMPAIGN',
          action: 'CAMPAIGN_PUBLIC_SLUG_REGENERATED',
          targetType: 'CAMPAIGN_PUBLIC_ACCESS',
          targetId: campaignId,
          summary: 'Regenerated campaign public slug.',
          metadata: {
            previousPublicSlug: existing?.publicSlug||null,
            nextPublicSlug: updated.publicSlug,
          },
        })
        return toOwnerDto(updated)
      }
      catch(error) {
        if(!isUniqueConstraintError(error)) {
          throw error
        }
      }
    }
    throw apiError(500,'PUBLIC_SLUG_GENERATION_FAILED','Unable to regenerate a unique public URL. Try again.')
  }
  private async resolvePublicAccess(publicSlug: string,section?: CampaignPublicAccessSection): Promise<PublicResolverResult> {
    const access=db.query.campaignPublicAccess.findFirst({ where: eq(campaignPublicAccess.publicSlug,publicSlug),with: { campaign: { columns: { id: true,name: true,system: true,description: true,dungeonMasterName: true } } } }).sync()
    if(!access||!access.isEnabled) {
      throw apiError(404,'PUBLIC_CAMPAIGN_NOT_FOUND','Public campaign not found.')
    }
    if(section) {
      const flag=sectionToFlag[section]
      if(!access[flag]) {
        throw apiError(404,'PUBLIC_SECTION_NOT_AVAILABLE','This public section is not available.')
      }
    }
    return {
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
  async getPublicOverview(publicSlug: string): Promise<CampaignPublicOverviewDto> {
    const resolved=await this.resolvePublicAccess(publicSlug)
    return {
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
    }
  }
  async getPublicJournalEntries(publicSlug: string,query: PublicCampaignJournalListQueryInput): Promise<CampaignJournalListResponse> {
    const resolved=await this.resolvePublicAccess(publicSlug,'journal')
    const page=query.page||campaignJournalListDefaultPage
    const pageSize=query.pageSize||campaignJournalListDefaultPageSize
    const normalizedTag=query.tag? normalizeJournalTagLabel(query.tag):undefined
    const where=and(eq(campaignJournalEntry.campaignId,resolved.campaignId),eq(campaignJournalEntry.visibility,'CAMPAIGN'),eq(campaignJournalEntry.isArchived,false),(query.sessionId? inArray(campaignJournalEntry.id,db.select({ id: campaignJournalEntrySessionLink.campaignJournalEntryId }).from(campaignJournalEntrySessionLink).where(eq(campaignJournalEntrySessionLink.sessionId,query.sessionId))):undefined),(normalizedTag? inArray(campaignJournalEntry.id,db.select({ id: campaignJournalTag.campaignJournalEntryId }).from(campaignJournalTag).where(eq(campaignJournalTag.normalizedLabel,normalizedTag))):undefined),(query.search? or(like(campaignJournalEntry.title,'%'+query.search+'%'),like(campaignJournalEntry.contentMarkdown,'%'+query.search+'%'),inArray(campaignJournalEntry.id,db.select({ id: campaignJournalTag.campaignJournalEntryId }).from(campaignJournalTag).where(like(campaignJournalTag.displayLabel,'%'+query.search+'%')))):undefined))
    const [total,rows]=db.transaction(() => [
      db.select({ value: count() }).from(campaignJournalEntry).where(where).get()!.value,
      db.query.campaignJournalEntry.findMany({ where: where,orderBy: (row,{ desc }) => [desc(row.updatedAt),desc(row.id)],offset: (page-1)*pageSize,limit: pageSize,with: { authorUser: { columns: { id: true,name: true } },tags: { orderBy: (row,{ asc }) => [asc(row.tagType),asc(row.displayLabel)],with: { glossaryEntry: { columns: { id: true,name: true } } } },sessionLinks: { orderBy: (row,{ asc }) => [asc(row.createdAt)],with: { session: { columns: { id: true,title: true,sessionNumber: true } } } } } }).sync(),
    ] as const,{ behavior: 'immediate' })
    return {
      items: rows.map((row) => ({
        id: row.id,
        campaignId: row.campaignId,
        authorUserId: row.authorUserId,
        authorName: row.authorUser.name,
        title: row.title,
        contentMarkdown: row.contentMarkdown,
        visibility: row.visibility,
        isDiscoverable: row.isDiscoverable,
        discoveredAt: row.discoveredAt?.toISOString()||null,
        isArchived: row.isArchived,
        sessions: row.sessionLinks.map((link) => ({
          sessionId: link.session.id,
          title: link.session.title,
          sessionNumber: link.session.sessionNumber,
        })),
        tags: row.tags.map((tag) => {
          if(tag.tagType==='CUSTOM') {
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
          if(tag.glossaryEntryId&&tag.glossaryEntry) {
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
        totalPages: Math.max(1,Math.ceil(total/pageSize)),
      },
    }
  }
  async listPublicCampaignDirectory(input: {
    limit?: number
    search?: string
    random?: boolean
  }) {
    const limit=Math.min(Math.max(input.limit||24,1),100)
    const search=(input.search||'').trim()
    const rows=db.query.campaignPublicAccess.findMany({ where: and(eq(campaignPublicAccess.isEnabled,true),eq(campaignPublicAccess.isListed,true),(search? inArray(campaignPublicAccess.campaignId,db.select({ id: campaign.id }).from(campaign).where(or(like(campaign.name,'%'+search+'%'),like(campaign.description,'%'+search+'%'),like(campaign.dungeonMasterName,'%'+search+'%'),like(campaign.system,'%'+search+'%')))):undefined)),orderBy: (row,{ desc }) => [desc(row.updatedAt)],limit: input.random? 100:limit,columns: { publicSlug: true,updatedAt: true },with: { campaign: { columns: { name: true,system: true,description: true,dungeonMasterName: true } } } }).sync()
    const sorted=rows.map(toDirectoryItem)
    if(!input.random) {
      return sorted
    }
    const shuffled=[...sorted]
    for(let i=shuffled.length-1;i>0;i-=1) {
      const j=Math.floor(Math.random()*(i+1))
      const tmp=shuffled[i]!
      shuffled[i]=shuffled[j]!
      shuffled[j]=tmp
    }
    return shuffled.slice(0,limit)
  }
  async getPublicCharacters(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'characters')
    const rows=db.query.campaignCharacter.findMany({ where: eq(campaignCharacter.campaignId,resolved.campaignId),orderBy: (row,{ desc }) => [desc(row.updatedAt)],columns: { status: true,roleLabel: true,notes: true },with: { character: { columns: { name: true,status: true,portraitUrl: true } } } }).sync()
    return rows.map((row) => ({
      name: row.character.name,
      status: row.character.status,
      portraitUrl: row.character.portraitUrl,
      campaignStatus: row.status,
      roleLabel: row.roleLabel,
      notes: row.notes,
    }))
  }
  async getPublicRecaps(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'recaps')
    const rows=db.query.recapRecording.findMany({ where: inArray(recapRecording.sessionId,db.select({ id: session.id }).from(session).where(eq(session.campaignId,resolved.campaignId))),orderBy: (row,{ desc }) => [desc(row.createdAt)],columns: { id: true,filename: true,mimeType: true,durationSeconds: true,createdAt: true },with: { session: { columns: { id: true,title: true,sessionNumber: true,playedAt: true } } } }).sync()
    return rows
  }
  async getPublicRecapPlayback(publicSlug: string,recapId: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'recaps')
    const recap=db.query.recapRecording.findFirst({ where: and(eq(recapRecording.id,recapId),inArray(recapRecording.sessionId,db.select({ id: session.id }).from(session).where(eq(session.campaignId,resolved.campaignId)))),columns: { id: true } }).sync()
    if(!recap) {
      throw apiError(404,'NOT_FOUND','Recap not found.')
    }
    return {
      url: `/api/public/campaigns/${publicSlug}/recaps/${recapId}/stream`,
    }
  }
  async getPublicRecapStream(publicSlug: string,recapId: string,rangeHeader?: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'recaps')
    const recap=db.query.recapRecording.findFirst({ where: and(eq(recapRecording.id,recapId),inArray(recapRecording.sessionId,db.select({ id: session.id }).from(session).where(eq(session.campaignId,resolved.campaignId)))),columns: { id: true,filename: true,mimeType: true },with: { artifact: { columns: { storageKey: true } } } }).sync()
    if(!recap) {
      throw apiError(404,'NOT_FOUND','Recap not found.')
    }
    const adapter=getStorageAdapter()
    const stream=await getMediaStream(adapter,recap.artifact.storageKey,rangeHeader)
    return {
      contentType: recap.mimeType,
      filename: recap.filename,
      stream,
    }
  }
  async getPublicSessions(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'sessions')
    const rows=db.query.session.findMany({ where: eq(session.campaignId,resolved.campaignId),orderBy: (row,{ asc,desc }) => [asc(row.sessionNumber),desc(row.playedAt),desc(row.createdAt)],columns: { title: true,sessionNumber: true,playedAt: true,notes: true,createdAt: true } }).sync()
    return rows
  }
  async getPublicGlossary(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'glossary')
    const rows=db.query.glossaryEntry.findMany({ where: eq(glossaryEntry.campaignId,resolved.campaignId),orderBy: (row,{ asc }) => [asc(row.name)],columns: { type: true,name: true,aliases: true,description: true },with: { sessions: { orderBy: (row,{ desc }) => [desc(row.createdAt)],with: { session: { columns: { title: true,sessionNumber: true,playedAt: true } } } } } }).sync()
    return rows
  }
  async getPublicQuests(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'quests')
    const rows=db.query.quest.findMany({ where: eq(quest.campaignId,resolved.campaignId),orderBy: (row,{ asc,desc }) => [asc(row.sortOrder),desc(row.createdAt)],with: { sourceNpc: { columns: { name: true } },sourceCharacter: { columns: { name: true } } } }).sync()
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      track: row.track,
      sourceType: row.sourceType,
      sourceText: row.sourceText,
      sourceNpcId: row.sourceNpcId,
      sourceNpcName: row.sourceNpc?.name||null,
      sourceCharacterId: row.sourceCharacterId,
      sourceCharacterName: row.sourceCharacter?.name||null,
      reward: row.reward,
      status: row.status,
      progressNotes: row.progressNotes,
      expirationDate: row.expirationYear!==null&&row.expirationMonth!==null&&row.expirationDay!==null
        ? {
          year: row.expirationYear,
          month: row.expirationMonth,
          day: row.expirationDay,
        }
        :null,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  }
  async getPublicMilestones(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'milestones')
    const rows=db.query.milestone.findMany({ where: eq(milestone.campaignId,resolved.campaignId),orderBy: (row,{ asc,desc }) => [asc(row.isComplete),desc(row.createdAt)],columns: { title: true,description: true,isComplete: true,completedAt: true,createdAt: true } }).sync()
    return rows
  }
  async getPublicMaps(publicSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'maps')
    const rows=db.query.campaignMap.findMany({ where: eq(campaignMap.campaignId,resolved.campaignId),orderBy: (row,{ asc,desc }) => [desc(row.isPrimary),asc(row.createdAt)],columns: { name: true,slug: true,isPrimary: true,status: true,createdAt: true } }).sync()
    return rows
  }
  async getPublicMapViewer(publicSlug: string,mapSlug?: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'maps')
    const map=db.query.campaignMap.findFirst({ where: and(eq(campaignMap.campaignId,resolved.campaignId),(mapSlug? eq(campaignMap.slug,mapSlug):eq(campaignMap.isPrimary,true))),orderBy: mapSlug? undefined:[desc(campaignMap.isPrimary),asc(campaignMap.createdAt)],columns: { id: true,campaignId: true,name: true,isPrimary: true,status: true,importVersion: true,sourceFingerprint: true,rawManifestJson: true } }).sync()
    if(!map) {
      throw apiError(404,'NOT_FOUND','Map not found.')
    }
    const features=db.query.campaignMapFeature.findMany({ where: eq(campaignMapFeature.campaignMapId,map.id),orderBy: (row,{ asc }) => [asc(row.featureType),asc(row.displayName)],columns: { id: true,geometryJson: true,propertiesJson: true,displayName: true,description: true,externalId: true,removed: true,sourceRef: true,featureType: true } }).sync()
    const manifest=(map.rawManifestJson||{}) as Record<string,unknown>
    const bounds=Array.isArray(manifest.bounds)&&manifest.bounds.length===2
      ? (manifest.bounds as [
        [
          number,
          number
        ],
        [
          number,
          number
        ]
      ])
      :[[-180,-85],[180,85]]
    const mapCoordinates=parseMapCoordinates(manifest.mapCoordinates)
    return {
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
        geometry: feature.geometryJson as {
          type: string
          coordinates: unknown
        },
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
          ...(feature.propertiesJson as Record<string,unknown>|null|undefined),
        },
      })),
    }
  }
  async getPublicMapSvg(publicSlug: string,mapSlug: string) {
    const resolved=await this.resolvePublicAccess(publicSlug,'maps')
    const map=db.query.campaignMap.findFirst({ where: and(eq(campaignMap.campaignId,resolved.campaignId),eq(campaignMap.slug,mapSlug)),columns: { slug: true },with: { files: { where: eq(campaignMapFile.kind,'SVG'),orderBy: (row,{ desc }) => [desc(row.createdAt)],limit: 1,columns: { storageKey: true,contentType: true } } } }).sync()
    if(!map) {
      throw apiError(404,'NOT_FOUND','Map not found.')
    }
    const svgFile=map.files[0]
    if(!svgFile) {
      throw apiError(404,'NOT_FOUND','No SVG source file found for this map.')
    }
    const adapter=getStorageAdapter()
    const stream=await adapter.getObject(svgFile.storageKey)
    return {
      contentType: svgFile.contentType||'image/svg+xml',
      filename: `${map.slug||'map'}.svg`,
      stream,
    }
  }
}
