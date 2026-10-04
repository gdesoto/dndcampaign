import { db } from '#server/db/client'
import { asc,and,or,eq,gte,inArray,like,count } from 'drizzle-orm'
import { session,campaignMember,campaignJournalEntryTransferHistory,glossaryEntry,campaignJournalEntry,campaignJournalTag,campaignJournalEntrySessionLink } from '#server/db/schema'
import { campaignJournalListMaxPageSize,campaignJournalListDefaultPage,campaignJournalListDefaultPageSize,} from '#shared/schemas/campaign-journal'
import type { CampaignJournalArchiveInput,CampaignJournalCreateInput,CampaignJournalDiscoverInput,CampaignJournalDiscoverableUpdateInput,CampaignJournalHistoryListQueryInput,CampaignJournalListQueryInput,CampaignJournalNotificationListQueryInput,CampaignJournalTagListQueryInput,CampaignJournalTagSuggestQueryInput,CampaignJournalTransferInput,CampaignJournalUpdateInput,} from '#shared/schemas/campaign-journal'
import type { CampaignJournalEntryDetail,CampaignJournalEntryListItem,CampaignJournalHistoryResponse,CampaignJournalListResponse,CampaignJournalMemberOption,CampaignJournalNotificationType,CampaignJournalNotificationListResponse,CampaignJournalTag,CampaignJournalTagListItem,CampaignJournalTagListResponse,CampaignJournalTagSuggestion,CampaignJournalTransferHistoryAction,CampaignJournalTransferHistoryItem,} from '#shared/types/campaign-journal'
import { extractJournalTagCandidatesFromMarkdown,normalizeGlossaryMentionLabel,normalizeJournalTagLabel,} from '#shared/utils/campaign-journal-tags'
import { hasCampaignDmAccess,type ResolvedCampaignAccess,} from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'
const JOURNAL_NOTIFICATION_RETENTION_DAYS=30
const tagOrder=[asc(campaignJournalTag.tagType),asc(campaignJournalTag.displayLabel)]
const sessionLinkOrder=[asc(campaignJournalEntrySessionLink.createdAt)]
const entryInclude={
  authorUser: { columns: { id: true,name: true } },
  tags: { with: { glossaryEntry: { columns: { id: true,name: true } } },orderBy: tagOrder },
  sessionLinks: { with: { session: { columns: { id: true,title: true,sessionNumber: true } } },orderBy: sessionLinkOrder },
  holderUser: { columns: { id: true,name: true } },
  discoveredByUser: { columns: { id: true,name: true } },
  archivedByUser: { columns: { id: true,name: true } },
} as const
const _entryRowQuery=() => db.query.campaignJournalEntry.findFirst({ with: entryInclude }).sync()
type EntryListRow=NonNullable<ReturnType<typeof _entryRowQuery>>
type EntryVisibilityRow=Pick<EntryListRow,'authorUserId'|'holderUserId'|'visibility'|'isDiscoverable'|'isArchived'>
const transferHistoryInclude={
  actorUser: { columns: { id: true,name: true } },
  fromHolderUser: { columns: { id: true,name: true } },
  toHolderUser: { columns: { id: true,name: true } },
} as const
const _historyRowQuery=() => db.query.campaignJournalEntryTransferHistory.findFirst({ with: transferHistoryInclude }).sync()
type TransferHistoryRow=NonNullable<ReturnType<typeof _historyRowQuery>>
const toTagDto=(tag: EntryListRow['tags'][number]): CampaignJournalTag => {
  if(tag.tagType==='CUSTOM') {
    return {
      id: tag.id,
      tagType: 'CUSTOM',
      displayLabel: tag.displayLabel,
      normalizedLabel: tag.normalizedLabel,
      glossaryEntryId: null,
      glossaryEntryName: null,
      isOrphanedGlossaryTag: false,
    }
  }
  if(tag.glossaryEntryId&&tag.glossaryEntry) {
    return {
      id: tag.id,
      tagType: 'GLOSSARY',
      displayLabel: tag.displayLabel,
      normalizedLabel: tag.normalizedLabel,
      glossaryEntryId: tag.glossaryEntry.id,
      glossaryEntryName: tag.glossaryEntry.name,
      isOrphanedGlossaryTag: false,
    }
  }
  return {
    id: tag.id,
    tagType: 'GLOSSARY',
    displayLabel: tag.displayLabel,
    normalizedLabel: tag.normalizedLabel,
    glossaryEntryId: null,
    glossaryEntryName: null,
    isOrphanedGlossaryTag: true,
  }
}
const isEntryVisibleToUser=(access: ResolvedCampaignAccess,userId: string,entry: EntryVisibilityRow) => {
  if(entry.isDiscoverable) {
    if(hasCampaignDmAccess(access))
      return true
    if(entry.holderUserId===userId)
      return true
    return entry.visibility==='CAMPAIGN'
  }
  if(entry.visibility==='CAMPAIGN')
    return true
  if(entry.authorUserId===userId)
    return true
  if(entry.visibility==='DM') {
    return hasCampaignDmAccess(access)
  }
  return false
}
const canManageEntry=(access: ResolvedCampaignAccess,userId: string,entry: EntryVisibilityRow) => {
  if(entry.isDiscoverable) {
    return hasCampaignDmAccess(access)
  }
  if(entry.authorUserId===userId)
    return true
  return hasCampaignDmAccess(access)&&isEntryVisibleToUser(access,userId,entry)
}
const canManageDiscoverableHolderState=(access: ResolvedCampaignAccess,userId: string,entry: EntryVisibilityRow) => hasCampaignDmAccess(access)||(entry.isDiscoverable&&entry.holderUserId===userId)
const toTransferHistoryDto=(row: TransferHistoryRow): CampaignJournalTransferHistoryItem => ({
  id: row.id,
  campaignJournalEntryId: row.campaignJournalEntryId,
  campaignId: row.campaignId,
  fromHolderUserId: row.fromHolderUserId,
  fromHolderUserName: row.fromHolderUser?.name||null,
  toHolderUserId: row.toHolderUserId,
  toHolderUserName: row.toHolderUser?.name||null,
  actorUserId: row.actorUserId,
  actorUserName: row.actorUser.name,
  action: row.action as CampaignJournalTransferHistoryAction,
  createdAt: row.createdAt.toISOString(),
})
const toEntryListItem=(row: EntryListRow,access: ResolvedCampaignAccess,userId: string): CampaignJournalEntryListItem => ({
  id: row.id,
  campaignId: row.campaignId,
  authorUserId: row.authorUserId,
  authorName: row.authorUser.name,
  title: row.title,
  contentMarkdown: row.contentMarkdown,
  visibility: row.visibility,
  holderUserId: row.holderUserId,
  holderUserName: row.holderUser?.name||null,
  isDiscoverable: row.isDiscoverable,
  discoveredAt: row.discoveredAt?.toISOString()||null,
  discoveredByUserId: row.discoveredByUserId,
  discoveredByUserName: row.discoveredByUser?.name||null,
  isArchived: row.isArchived,
  archivedAt: row.archivedAt?.toISOString()||null,
  archivedByUserId: row.archivedByUserId,
  archivedByUserName: row.archivedByUser?.name||null,
  sessions: row.sessionLinks.map((link) => ({
    sessionId: link.session.id,
    title: link.session.title,
    sessionNumber: link.session.sessionNumber,
  })),
  tags: row.tags.map(toTagDto),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  canView: isEntryVisibleToUser(access,userId,row),
  canEdit: canManageEntry(access,userId,row),
  canDelete: row.isDiscoverable? hasCampaignDmAccess(access):canManageEntry(access,userId,row),
})
const getPagination=(query: {
  page?: number
  pageSize?: number
}) => {
  const page=query.page||campaignJournalListDefaultPage
  const pageSize=query.pageSize||campaignJournalListDefaultPageSize
  return {
    page,
    pageSize,
    skip: (page-1)*pageSize,
    take: pageSize,
  }
}
const uniqueStrings=(values: string[]) => Array.from(new Set(values.filter(Boolean)))
const entryVisibilityWhere=(access: ResolvedCampaignAccess,userId: string) => {
  if(hasCampaignDmAccess(access)) {
    return or(eq(campaignJournalEntry.isDiscoverable,true),and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'CAMPAIGN' as const)),and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'DM' as const)),and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'MYSELF' as const),eq(campaignJournalEntry.authorUserId,userId)))
  }
  return or(and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'CAMPAIGN' as const)),and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'DM' as const),eq(campaignJournalEntry.authorUserId,userId)),and(eq(campaignJournalEntry.isDiscoverable,false),eq(campaignJournalEntry.visibility,'MYSELF' as const),eq(campaignJournalEntry.authorUserId,userId)),and(eq(campaignJournalEntry.isDiscoverable,true),eq(campaignJournalEntry.holderUserId,userId)),and(eq(campaignJournalEntry.isDiscoverable,true),eq(campaignJournalEntry.visibility,'CAMPAIGN' as const)))
}
type ResolvedCreateData={
  sessionIds: string[]
  tags: Array<{
    tagType: 'CUSTOM'
    normalizedLabel: string
    displayLabel: string
    glossaryEntryId: null
  }|{
    tagType: 'GLOSSARY'
    normalizedLabel: string
    displayLabel: string
    glossaryEntryId: string|null
  }>
}
export class CampaignJournalService {
  private async resolveSessionIds(campaignId: string,sessionIds: string[]): Promise<string[]> {
    const uniqueIds=uniqueStrings(sessionIds)
    if(!uniqueIds.length)
      return []
    const found=db.query.session.findMany({ where: and(eq(session.campaignId,campaignId),inArray(session.id,uniqueIds)),columns: { id: true } }).sync()
    if(found.length!==uniqueIds.length) {
      throw apiError(400,'VALIDATION_ERROR','One or more sessions do not belong to this campaign')
    }
    return uniqueIds
  }
  private validateDiscoverableHolderVisibility(visibility: 'MYSELF'|'DM'|'CAMPAIGN'): true {
    if(visibility==='MYSELF') {
      throw apiError(400,'VALIDATION_ERROR','Discoverable entries require visibility DM or CAMPAIGN',{ visibility: 'Discoverable entries cannot be MYSELF' })
    }
    return true
  }
  private async ensureCampaignMemberHolder(campaignId: string,holderUserId: string|null): Promise<true> {
    if(!holderUserId)
      return true
    const holderMembership=db.query.campaignMember.findFirst({ where: and(eq(campaignMember.campaignId,campaignId),eq(campaignMember.userId,holderUserId)),columns: { id: true } }).sync()
    if(!holderMembership) {
      throw apiError(400,'VALIDATION_ERROR','Holder must be a campaign member',{ holderUserId: 'Select a campaign member as holder' })
    }
    return true
  }
  private createTransferHistory(tx: Parameters<Parameters<typeof db.transaction>[0]>[0],input: {
    campaignId: string
    campaignJournalEntryId: string
    fromHolderUserId: string|null
    toHolderUserId: string|null
    actorUserId: string
    action: CampaignJournalTransferHistoryAction
  }) {
    tx.insert(campaignJournalEntryTransferHistory).values({
      campaignId: input.campaignId,
      campaignJournalEntryId: input.campaignJournalEntryId,
      fromHolderUserId: input.fromHolderUserId,
      toHolderUserId: input.toHolderUserId,
      actorUserId: input.actorUserId,
      action: input.action,
    }).returning().get()
  }
  private async resolveTagData(campaignId: string,input: Pick<CampaignJournalCreateInput,'contentMarkdown'|'tags'>): Promise<ResolvedCreateData['tags']> {
    const extracted=extractJournalTagCandidatesFromMarkdown(input.contentMarkdown)
    const explicitCustom=(input.tags||[])
      .filter((tag): tag is {
        type: 'CUSTOM'
        label: string
      } => tag.type==='CUSTOM')
      .map((tag) => tag.label)
      .map(normalizeJournalTagLabel)
      .filter(Boolean)
    const customLabels=uniqueStrings([...explicitCustom,...extracted.customTags])
    const customTags: ResolvedCreateData['tags']=customLabels.map((label) => ({
      tagType: 'CUSTOM',
      normalizedLabel: label,
      displayLabel: label,
      glossaryEntryId: null,
    }))
    const explicitGlossaryIds=uniqueStrings((input.tags||[])
      .filter((tag): tag is {
        type: 'GLOSSARY'
        glossaryEntryId: string
      } => tag.type==='GLOSSARY')
      .map((tag) => tag.glossaryEntryId))
    const extractedMentionLabels=uniqueStrings(extracted.glossaryMentions.map(normalizeGlossaryMentionLabel).filter(Boolean))
    const glossaryById=explicitGlossaryIds.length
      ? db.query.glossaryEntry.findMany({ where: and(eq(glossaryEntry.campaignId,campaignId),inArray(glossaryEntry.id,explicitGlossaryIds)),columns: { id: true,name: true } }).sync()
      :[]
    const glossaryByName=extractedMentionLabels.length
      ? db.query.glossaryEntry.findMany({ where: and(eq(glossaryEntry.campaignId,campaignId),inArray(glossaryEntry.name,extractedMentionLabels)),columns: { id: true,name: true } }).sync()
      :[]
    const glossaryMap=new Map<string,{
      id: string
      name: string
    }>()
    for(const entry of glossaryById)
      glossaryMap.set(entry.id,entry)
    for(const entry of glossaryByName)
      glossaryMap.set(entry.id,entry)
    const glossaryTags: ResolvedCreateData['tags']=Array.from(glossaryMap.values()).map((entry) => ({
      tagType: 'GLOSSARY',
      normalizedLabel: normalizeJournalTagLabel(entry.name),
      displayLabel: entry.name,
      glossaryEntryId: entry.id,
    }))
    const dedupeKeySet=new Set<string>()
    const merged: ResolvedCreateData['tags']=[]
    for(const tag of [...customTags,...glossaryTags]) {
      const key=`${tag.tagType}:${tag.normalizedLabel}:${tag.glossaryEntryId||''}`
      if(dedupeKeySet.has(key))
        continue
      dedupeKeySet.add(key)
      merged.push(tag)
    }
    return merged
  }
  private async getAuthorizedEntry(campaignId: string,entryId: string,userId: string,access: ResolvedCampaignAccess): Promise<EntryListRow> {
    const row=db.query.campaignJournalEntry.findFirst({ where: and(eq(campaignJournalEntry.id,entryId),eq(campaignJournalEntry.campaignId,campaignId)),with: entryInclude }).sync()
    if(!row) {
      throw apiError(404,'NOT_FOUND','Journal entry not found')
    }
    if(!isEntryVisibleToUser(access,userId,row)) {
      throw apiError(404,'NOT_FOUND','Journal entry not found')
    }
    return row
  }
  async createEntry(access: ResolvedCampaignAccess,userId: string,input: CampaignJournalCreateInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    const sessionIds=await this.resolveSessionIds(campaignId,input.sessionIds||[])
    const resolvedTags=await this.resolveTagData(campaignId,input)
    const created=db.transaction((tx) => {
      const entry=tx.insert(campaignJournalEntry).values({ campaignId,authorUserId: userId,title: input.title,contentMarkdown: input.contentMarkdown,visibility: input.visibility }).returning().get()!
      if(resolvedTags.length)
        tx.insert(campaignJournalTag).values(resolvedTags.map((tag) => ({ ...tag,campaignId,campaignJournalEntryId: entry.id }))).run()
      if(sessionIds.length)
        tx.insert(campaignJournalEntrySessionLink).values(sessionIds.map((sessionId) => ({ campaignId,sessionId,campaignJournalEntryId: entry.id }))).run()
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,entry.id),with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(created,access,userId)
  }
  async listEntries(access: ResolvedCampaignAccess,userId: string,query: CampaignJournalListQueryInput): Promise<CampaignJournalListResponse> {
    const campaignId=access.campaignId
    if(query.dmVisible&&!hasCampaignDmAccess(access)) {
      throw apiError(403,'FORBIDDEN','DM access is required for dmVisible filter')
    }
    const visibilityWhere=entryVisibilityWhere(access,userId)
    const tagSearch=query.tag? normalizeJournalTagLabel(query.tag):undefined
    const recentlyDiscoveredSince=new Date(Date.now()-JOURNAL_NOTIFICATION_RETENTION_DAYS*24*60*60*1000)
    const where=and(eq(campaignJournalEntry.campaignId,campaignId),visibilityWhere,(query.visibility? eq(campaignJournalEntry.visibility,query.visibility):undefined),(query.authorId? eq(campaignJournalEntry.authorUserId,query.authorId):undefined),(query.mine? eq(campaignJournalEntry.authorUserId,userId):undefined),(query.discoverable!==undefined? eq(campaignJournalEntry.isDiscoverable,query.discoverable):undefined),(query.heldByMe? and(eq(campaignJournalEntry.isDiscoverable,true),eq(campaignJournalEntry.holderUserId,userId)):undefined),(query.archived!==undefined? eq(campaignJournalEntry.isArchived,query.archived):(query.includeArchived? undefined:eq(campaignJournalEntry.isArchived,false))),(query.recentlyDiscovered? and(eq(campaignJournalEntry.isDiscoverable,true),gte(campaignJournalEntry.discoveredAt,recentlyDiscoveredSince)):undefined),(query.sessionId? inArray(campaignJournalEntry.id,db.select({ id: campaignJournalEntrySessionLink.campaignJournalEntryId }).from(campaignJournalEntrySessionLink).where(eq(campaignJournalEntrySessionLink.sessionId,query.sessionId))):undefined),(query.tagType||tagSearch? inArray(campaignJournalEntry.id,db.select({ id: campaignJournalTag.campaignJournalEntryId }).from(campaignJournalTag).where(and((query.tagType? eq(campaignJournalTag.tagType,query.tagType):undefined),(tagSearch? eq(campaignJournalTag.normalizedLabel,tagSearch):undefined)))):undefined),(query.search? or(like(campaignJournalEntry.title,'%'+query.search+'%'),like(campaignJournalEntry.contentMarkdown,'%'+query.search+'%'),inArray(campaignJournalEntry.id,db.select({ id: campaignJournalTag.campaignJournalEntryId }).from(campaignJournalTag).where(like(campaignJournalTag.displayLabel,'%'+query.search+'%')))):undefined))
    const pagination=getPagination(query)
    const [total,rows]=db.transaction(() => [
      db.select({ value: count() }).from(campaignJournalEntry).where(where).get()!.value,
      db.query.campaignJournalEntry.findMany({ where: where,orderBy: (row,{ desc }) => [desc(row.updatedAt),desc(row.id)],offset: pagination.skip,limit: pagination.take,with: entryInclude }).sync(),
    ] as const,{ behavior: 'immediate' })
    const items=rows.map((row) => toEntryListItem(row,access,userId))
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.max(1,Math.ceil(total/pagination.pageSize)),
      },
    }
  }
  async getEntryById(access: ResolvedCampaignAccess,entryId: string,userId: string): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    return toEntryListItem(entry,access,userId)
  }
  async updateEntry(access: ResolvedCampaignAccess,entryId: string,userId: string,input: CampaignJournalUpdateInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    const existing=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    const isDm=hasCampaignDmAccess(access)
    if(existing.isDiscoverable) {
      const holderCanManageState=canManageDiscoverableHolderState(access,userId,existing)
      if(!holderCanManageState) {
        throw apiError(403,'FORBIDDEN','You do not have permission to edit this discoverable journal entry')
      }
      if(!isDm) {
        const includesNonVisibilityFields=input.title!==undefined||
          input.contentMarkdown!==undefined||
          input.sessionIds!==undefined||
          input.tags!==undefined
        if(includesNonVisibilityFields) {
          throw apiError(403,'FORBIDDEN','Only DM-access users can edit discoverable entry content')
        }
        if(input.visibility==='MYSELF') {
          throw apiError(400,'VALIDATION_ERROR','Discoverable entries cannot be set to MYSELF visibility',{ visibility: 'Choose DM or CAMPAIGN visibility' })
        }
      }
    }
    else if(!canManageEntry(access,userId,existing)) {
      throw apiError(403,'FORBIDDEN','You do not have permission to edit this journal entry')
    }
    if(existing.isDiscoverable&&input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }
    const nextContent=input.contentMarkdown??existing.contentMarkdown
    const sessionIds=await this.resolveSessionIds(campaignId,input.sessionIds??existing.sessionLinks.map((link) => link.session.id))
    const resolvedTags=await this.resolveTagData(campaignId,{
      contentMarkdown: nextContent,
      tags: input.tags,
    })
    const updated=db.transaction((tx) => {
      tx.delete(campaignJournalTag).where(eq(campaignJournalTag.campaignJournalEntryId,existing.id)).run()
      tx.delete(campaignJournalEntrySessionLink).where(eq(campaignJournalEntrySessionLink.campaignJournalEntryId,existing.id)).run()
      if(resolvedTags.length) {
        tx.insert(campaignJournalTag).values(resolvedTags.map((tag) => ({
          campaignJournalEntryId: existing.id,
          campaignId,
          tagType: tag.tagType,
          normalizedLabel: tag.normalizedLabel,
          displayLabel: tag.displayLabel,
          glossaryEntryId: tag.glossaryEntryId,
        }))).run()
      }
      if(sessionIds.length) {
        tx.insert(campaignJournalEntrySessionLink).values(sessionIds.map((sessionId) => ({
          campaignJournalEntryId: existing.id,
          campaignId,
          sessionId,
        }))).run()
      }
      const updateData = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.contentMarkdown !== undefined ? { contentMarkdown: input.contentMarkdown } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      }
      if (Object.keys(updateData).length) {
        tx.update(campaignJournalEntry).set(updateData).where(eq(campaignJournalEntry.id, existing.id)).run()
      }
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id, existing.id), with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(updated,access,userId)
  }
  async deleteEntry(access: ResolvedCampaignAccess,entryId: string,userId: string): Promise<{
    id: string
  }> {
    const campaignId=access.campaignId
    const existing=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    if(existing.isDiscoverable&&!hasCampaignDmAccess(access)) {
      throw apiError(403,'FORBIDDEN','Only DM-access users can delete discoverable journal entries')
    }
    if(!existing.isDiscoverable&&!canManageEntry(access,userId,existing)) {
      throw apiError(403,'FORBIDDEN','You do not have permission to delete this journal entry')
    }
    db.delete(campaignJournalEntry).where(eq(campaignJournalEntry.id,existing.id)).run()
    return { id: existing.id }
  }
  async updateDiscoverable(access: ResolvedCampaignAccess,entryId: string,userId: string,input: CampaignJournalDiscoverableUpdateInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    if(!hasCampaignDmAccess(access)) {
      throw apiError(403,'FORBIDDEN','DM access is required to update discoverable settings')
    }
    await this.ensureCampaignMemberHolder(campaignId,input.holderUserId??null)
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    if(input.isDiscoverable&&input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }
    const updated=db.transaction((tx) => {
      if(input.isDiscoverable) {
        const targetVisibility=input.visibility??(entry.visibility==='MYSELF'? 'DM':entry.visibility)
        const targetHolderUserId=input.holderUserId===undefined? entry.holderUserId:input.holderUserId
        const now=new Date()
        const transferAction: CampaignJournalTransferHistoryAction=!entry.isDiscoverable||!entry.discoveredAt
          ? 'DISCOVERED'
          :targetHolderUserId!==entry.holderUserId
            ? targetHolderUserId
              ? 'TRANSFERRED'
              :'UNASSIGNED'
            :'DISCOVERED'
        const nextDiscoveredAt=entry.discoveredAt||now
        const nextDiscoveredByUserId=entry.discoveredByUserId||userId
        const next=tx.update(campaignJournalEntry).set({
          isDiscoverable: true,
          holderUserId: targetHolderUserId,
          discoveredAt: nextDiscoveredAt,
          discoveredByUserId: nextDiscoveredByUserId,
          visibility: targetVisibility,
        }).where(eq(campaignJournalEntry.id,entry.id)).returning().get()!
        this.createTransferHistory(tx,{
          campaignId,
          campaignJournalEntryId: entry.id,
          fromHolderUserId: entry.holderUserId,
          toHolderUserId: targetHolderUserId,
          actorUserId: userId,
          action: transferAction,
        })
        return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,next.id),with: entryInclude }).sync()!
      }
      const next=tx.update(campaignJournalEntry).set({
        isDiscoverable: false,
        holderUserId: null,
        discoveredAt: null,
        discoveredByUserId: null,
      }).where(eq(campaignJournalEntry.id,entry.id)).returning().get()!
      this.createTransferHistory(tx,{
        campaignId,
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: null,
        actorUserId: userId,
        action: 'UNASSIGNED',
      })
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,next.id),with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(updated,access,userId)
  }
  async discoverEntry(access: ResolvedCampaignAccess,entryId: string,userId: string,input: CampaignJournalDiscoverInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    if(!hasCampaignDmAccess(access)) {
      throw apiError(403,'FORBIDDEN','DM access is required to discover journal entries')
    }
    await this.ensureCampaignMemberHolder(campaignId,input.holderUserId)
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    if(input.visibility) {
      this.validateDiscoverableHolderVisibility(input.visibility)
    }
    const updated=db.transaction((tx) => {
      const nextVisibility=input.visibility??(entry.visibility==='MYSELF'? 'DM':entry.visibility)
      const nextDiscoveredAt=entry.discoveredAt||new Date()
      const nextDiscoveredByUserId=entry.discoveredByUserId||userId
      const next=tx.update(campaignJournalEntry).set({
        isDiscoverable: true,
        holderUserId: input.holderUserId,
        discoveredAt: nextDiscoveredAt,
        discoveredByUserId: nextDiscoveredByUserId,
        visibility: nextVisibility,
      }).where(eq(campaignJournalEntry.id,entry.id)).returning().get()!
      const action: CampaignJournalTransferHistoryAction=entry.holderUserId
        ? 'TRANSFERRED'
        :'DISCOVERED'
      this.createTransferHistory(tx,{
        campaignId,
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: input.holderUserId,
        actorUserId: userId,
        action,
      })
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,next.id),with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(updated,access,userId)
  }
  async transferEntry(access: ResolvedCampaignAccess,entryId: string,userId: string,input: CampaignJournalTransferInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    if(!entry.isDiscoverable) {
      throw apiError(400,'VALIDATION_ERROR','Only discoverable entries can be transferred')
    }
    if(!canManageDiscoverableHolderState(access,userId,entry)) {
      throw apiError(403,'FORBIDDEN','Only DM-access users or current holder can transfer this entry')
    }
    await this.ensureCampaignMemberHolder(campaignId,input.toHolderUserId)
    const nextVisibility=input.visibility??entry.visibility
    this.validateDiscoverableHolderVisibility(nextVisibility)
    const updated=db.transaction((tx) => {
      const next=tx.update(campaignJournalEntry).set({
        holderUserId: input.toHolderUserId,
        visibility: nextVisibility,
        isDiscoverable: true,
      }).where(eq(campaignJournalEntry.id,entry.id)).returning().get()!
      const action: CampaignJournalTransferHistoryAction=input.toHolderUserId? 'TRANSFERRED':'UNASSIGNED'
      this.createTransferHistory(tx,{
        campaignId,
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: input.toHolderUserId,
        actorUserId: userId,
        action,
      })
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,next.id),with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(updated,access,userId)
  }
  async archiveEntry(access: ResolvedCampaignAccess,entryId: string,userId: string,input: CampaignJournalArchiveInput): Promise<CampaignJournalEntryDetail> {
    const campaignId=access.campaignId
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    if(!canManageDiscoverableHolderState(access,userId,entry)) {
      throw apiError(403,'FORBIDDEN','Only DM-access users or holder can archive this entry')
    }
    const targetArchived=input.archived
    if(entry.isArchived===targetArchived) {
      return toEntryListItem(entry,access,userId)
    }
    const updated=db.transaction((tx) => {
      const next=tx.update(campaignJournalEntry).set(targetArchived
        ? {
          isArchived: true,
          archivedAt: new Date(),
          archivedByUserId: userId,
        }
        :{
          isArchived: false,
          archivedAt: null,
          archivedByUserId: null,
        }).where(eq(campaignJournalEntry.id,entry.id)).returning().get()!
      this.createTransferHistory(tx,{
        campaignId,
        campaignJournalEntryId: entry.id,
        fromHolderUserId: entry.holderUserId,
        toHolderUserId: entry.holderUserId,
        actorUserId: userId,
        action: targetArchived? 'ARCHIVED':'UNARCHIVED',
      })
      return tx.query.campaignJournalEntry.findFirst({ where: eq(campaignJournalEntry.id,next.id),with: entryInclude }).sync()!
    },{ behavior: 'immediate' })
    return toEntryListItem(updated,access,userId)
  }
  async listEntryHistory(access: ResolvedCampaignAccess,entryId: string,userId: string,query: CampaignJournalHistoryListQueryInput): Promise<CampaignJournalHistoryResponse> {
    const campaignId=access.campaignId
    const entry=await this.getAuthorizedEntry(campaignId,entryId,userId,access)
    const pagination=getPagination(query)
    const where=and(eq(campaignJournalEntryTransferHistory.campaignId,campaignId),eq(campaignJournalEntryTransferHistory.campaignJournalEntryId,entry.id))
    const [total,rows]=db.transaction(() => [
      db.select({ value: count() }).from(campaignJournalEntryTransferHistory).where(where).get()!.value,
      db.query.campaignJournalEntryTransferHistory.findMany({ where: where,with: transferHistoryInclude,orderBy: (row,{ desc }) => [desc(row.createdAt),desc(row.id)],offset: pagination.skip,limit: pagination.take }).sync(),
    ] as const,{ behavior: 'immediate' })
    return {
      items: rows.map(toTransferHistoryDto),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.max(1,Math.ceil(total/pagination.pageSize)),
      },
    }
  }
  async listNotifications(access: ResolvedCampaignAccess,userId: string,query: CampaignJournalNotificationListQueryInput): Promise<CampaignJournalNotificationListResponse> {
    const campaignId=access.campaignId
    const retentionFloor=new Date(Date.now()-JOURNAL_NOTIFICATION_RETENTION_DAYS*24*60*60*1000)
    const sinceFilter=query.since? new Date(query.since):null
    const createdAt=sinceFilter&&sinceFilter>retentionFloor? sinceFilter:retentionFloor
    const pagination=getPagination({
      page: query.page,
      pageSize: Math.min(query.pageSize||campaignJournalListDefaultPageSize,campaignJournalListMaxPageSize),
    })
    const historyRows=db.query.campaignJournalEntryTransferHistory.findMany({
      where: and(eq(campaignJournalEntryTransferHistory.campaignId,campaignId),gte(campaignJournalEntryTransferHistory.createdAt,createdAt),(query.type? eq(campaignJournalEntryTransferHistory.action,query.type==='DISCOVERED'
        ? 'DISCOVERED'
        :query.type==='TRANSFERRED'
          ? 'TRANSFERRED'
          :query.type==='ARCHIVED'
            ? 'ARCHIVED'
            :'UNARCHIVED'):undefined)),orderBy: (row,{ desc }) => [desc(row.createdAt),desc(row.id)],with: { ...transferHistoryInclude,entry: { columns: { id: true,title: true,visibility: true,authorUserId: true,holderUserId: true,isDiscoverable: true,isArchived: true } } }
    }).sync()
    const visibleRows=historyRows.filter((row) => isEntryVisibleToUser(access,userId,{
      authorUserId: row.entry.authorUserId,
      holderUserId: row.entry.holderUserId,
      visibility: row.entry.visibility,
      isDiscoverable: row.entry.isDiscoverable,
      isArchived: row.entry.isArchived,
    }))
    const items=visibleRows
      .map((row) => {
        const type: CampaignJournalNotificationType|null=row.action==='DISCOVERED'
          ? 'DISCOVERED'
          :row.action==='TRANSFERRED'
            ? 'TRANSFERRED'
            :row.action==='ARCHIVED'
              ? 'ARCHIVED'
              :row.action==='UNARCHIVED'
                ? 'UNARCHIVED'
                :null
        if(!type)
          return null
        const toName=row.toHolderUser?.name||'Unassigned'
        const fromName=row.fromHolderUser?.name||'Unassigned'
        const actorName=row.actorUser.name
        const message=type==='DISCOVERED'
          ? `${actorName} discovered "${row.entry.title}" for ${toName}.`
          :type==='TRANSFERRED'
            ? `${actorName} transferred "${row.entry.title}" from ${fromName} to ${toName}.`
            :type==='ARCHIVED'
              ? `${actorName} archived "${row.entry.title}".`
              :`${actorName} unarchived "${row.entry.title}".`
        return {
          id: row.id,
          campaignId: row.campaignId,
          entryId: row.entry.id,
          type,
          title: row.entry.title,
          message,
          actorUserId: row.actorUserId,
          actorUserName: row.actorUser.name,
          createdAt: row.createdAt.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    const total=items.length
    const pagedItems=items.slice(pagination.skip,pagination.skip+pagination.take)
    return {
      items: pagedItems,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.max(1,Math.ceil(total/pagination.pageSize)),
      },
    }
  }
  async listMemberOptions(access: ResolvedCampaignAccess): Promise<{
    items: CampaignJournalMemberOption[]
  }> {
    const campaignId=access.campaignId
    const members=db.query.campaignMember.findMany({ where: eq(campaignMember.campaignId,campaignId),orderBy: (row,{ asc }) => [asc(row.role),asc(row.createdAt)],columns: { userId: true,role: true,hasDmAccess: true },with: { user: { columns: { name: true } } } }).sync()
    return {
      items: members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        role: member.role,
        hasDmAccess: member.hasDmAccess,
      })),
    }
  }
  async listTags(access: ResolvedCampaignAccess,userId: string,query: CampaignJournalTagListQueryInput): Promise<CampaignJournalTagListResponse> {
    const campaignId=access.campaignId
    const visibilityWhere=entryVisibilityWhere(access,userId)
    const queryLabel=query.query? normalizeJournalTagLabel(query.query):undefined
    const rows=db.query.campaignJournalTag.findMany({ where: and(eq(campaignJournalTag.campaignId,campaignId),(query.type? eq(campaignJournalTag.tagType,query.type):undefined),(queryLabel? like(campaignJournalTag.normalizedLabel,'%'+queryLabel+'%'):undefined),inArray(campaignJournalTag.campaignJournalEntryId,db.select({ id: campaignJournalEntry.id }).from(campaignJournalEntry).where(visibilityWhere))),columns: { tagType: true,displayLabel: true,normalizedLabel: true,glossaryEntryId: true },with: { glossaryEntry: { columns: { id: true,name: true } } } }).sync()
    const map=new Map<string,CampaignJournalTagListItem>()
    for(const row of rows) {
      const key=`${row.tagType}:${row.normalizedLabel}:${row.glossaryEntryId||''}`
      if(!map.has(key)) {
        map.set(key,{
          tagType: row.tagType,
          displayLabel: row.displayLabel,
          normalizedLabel: row.normalizedLabel,
          usageCount: 0,
          glossaryEntryId: row.glossaryEntryId,
          glossaryEntryName: row.glossaryEntry?.name||null,
          isOrphanedGlossaryTag: row.tagType==='GLOSSARY'&&!row.glossaryEntryId,
        })
      }
      const current=map.get(key)!
      current.usageCount+=1
    }
    const allItems=Array.from(map.values()).sort((a,b) => {
      if(b.usageCount!==a.usageCount)
        return b.usageCount-a.usageCount
      return a.displayLabel.localeCompare(b.displayLabel)
    })
    const pagination=getPagination(query)
    const start=pagination.skip
    const end=start+pagination.take
    const items=allItems.slice(start,end)
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: allItems.length,
        totalPages: Math.max(1,Math.ceil(allItems.length/pagination.pageSize)),
      },
    }
  }
  async suggestTags(access: ResolvedCampaignAccess,userId: string,query: CampaignJournalTagSuggestQueryInput): Promise<{
    items: CampaignJournalTagSuggestion[]
  }> {
    const result=await this.listTags(access,userId,{
      type: query.type,
      query: query.query,
      page: 1,
      pageSize: query.limit,
    })
    const items: CampaignJournalTagSuggestion[]=result.items.map((item) => ({
      tagType: item.tagType,
      displayLabel: item.displayLabel,
      normalizedLabel: item.normalizedLabel,
      glossaryEntryId: item.glossaryEntryId,
      glossaryEntryName: item.glossaryEntryName,
    }))
    return { items }
  }
}
