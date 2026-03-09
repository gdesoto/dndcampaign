type AdminUserListQuery = {
  search?: string
  status?: 'all' | 'active' | 'inactive'
  role?: 'all' | 'USER' | 'SYSTEM_ADMIN'
  page?: number
  pageSize?: number
}

type AdminCampaignListQuery = {
  search?: string
  archived?: 'all' | 'active' | 'archived'
  page?: number
  pageSize?: number
}

type AdminAnalyticsQuery = {
  from?: string
  to?: string
  campaignLimit?: number
}

type AdminActivityQuery = {
  search?: string
  scope?: 'all' | 'CAMPAIGN' | 'ADMIN' | 'SYSTEM'
  action?: string
  actorUserId?: string
  campaignId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

type AdminStorageAuditQuery = {
  campaignId?: string
  issuesOnly?: boolean
}

type AdminStorageAuditFixPayload =
  | { action: 'DELETE_ORPHAN_STORAGE_FILE'; storageKey: string }
  | { action: 'DELETE_UNREFERENCED_ARTIFACT'; artifactId: string }
  | { action: 'REPAIR_DOCUMENT_CURRENT_VERSION'; documentId: string }
  | { action: 'DELETE_EMPTY_DOCUMENT'; documentId: string }

export const useAdmin = () => {
  const { request } = useApi()

  const toQuery = (input: Record<string, string | number | boolean | undefined>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === '') continue
      params.set(key, String(value))
    }

    const query = params.toString()
    return query ? `?${query}` : ''
  }

  const getUsers = (query: AdminUserListQuery = {}) =>
    request<{
      users: Array<{
        id: string
        email: string
        name: string
        systemRole: 'USER' | 'SYSTEM_ADMIN'
        isActive: boolean
        avatarUrl: string | null
        lastLoginAt: string | null
        createdAt: string
        updatedAt: string
        ownedCampaignCount: number
        memberCampaignCount: number
      }>
      page: number
      pageSize: number
      total: number
    }>(`/api/admin/users${toQuery(query)}`)

  const getUser = (userId: string) => request(`/api/admin/users/${userId}`)

  const updateUser = (userId: string, payload: { isActive?: boolean; systemRole?: 'USER' | 'SYSTEM_ADMIN' }) =>
    request<{
      id: string
      systemRole: 'USER' | 'SYSTEM_ADMIN'
      isActive: boolean
      updatedAt: string
    }>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: payload,
    })

  const getCampaigns = (query: AdminCampaignListQuery = {}) =>
    request<{
      campaigns: Array<{
        id: string
        name: string
        system: string
        isArchived: boolean
        owner: { id: string; email: string; name: string }
        memberCount: number
        sessionCount: number
        glossaryCount: number
        questCount: number
        milestoneCount: number
        documentCount: number
        createdAt: string
        updatedAt: string
      }>
      page: number
      pageSize: number
      total: number
    }>(`/api/admin/campaigns${toQuery(query)}`)

  const getCampaign = (campaignId: string) => request(`/api/admin/campaigns/${campaignId}`)

  const updateCampaign = (
    campaignId: string,
    payload: { isArchived?: boolean; transferOwnerUserId?: string }
  ) =>
    request<{
      id: string
      ownerId: string
      isArchived: boolean
      updatedAt: string
    }>(`/api/admin/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: payload,
    })

  const getOverview = (at?: string) => request(`/api/admin/analytics/overview${toQuery({ at })}`)
  const getUsage = (query: AdminAnalyticsQuery = {}) => request(`/api/admin/analytics/usage${toQuery(query)}`)
  const getJobs = (query: AdminAnalyticsQuery = {}) => request(`/api/admin/analytics/jobs${toQuery(query)}`)
  const getActivity = (query: AdminActivityQuery = {}) =>
    request<{
      logs: Array<{
        id: string
        scope: 'CAMPAIGN' | 'ADMIN' | 'SYSTEM'
        action: string
        targetType: string | null
        targetId: string | null
        summary: string | null
        metadata: unknown
        createdAt: string
        actorUserId: string | null
        actorUser: {
          id: string
          email: string
          name: string
        } | null
        campaignId: string | null
        campaign: {
          id: string
          name: string
        } | null
      }>
      page: number
      pageSize: number
      total: number
    }>(`/api/admin/activity${toQuery(query)}`)

  const getUsageCsvUrl = (query: AdminAnalyticsQuery = {}) =>
    `/api/admin/analytics/usage.csv${toQuery(query)}`
  const getJobsCsvUrl = (query: AdminAnalyticsQuery = {}) =>
    `/api/admin/analytics/jobs.csv${toQuery(query)}`
  const getStorageAudit = (query: AdminStorageAuditQuery = {}) =>
    request<{
      generatedAt: string
      provider: string
      localRoot: string
      warnings: string[]
      filters: {
        campaignId: string | null
        issuesOnly: boolean
      }
      summary: {
        artifacts: {
          total: number
          ok: number
          missingFile: number
          unreferenced: number
        }
        storage: {
          scannedFiles: number
          orphanFiles: number
          rootExists: boolean
        }
        documents: {
          total: number
          ok: number
          missingCurrentVersion: number
          empty: number
        }
        totalIssues: number
        fixableIssues: number
      }
      artifactRows: Array<{
        artifactId: string
        campaignId: string | null
        campaignName: string | null
        storageKey: string
        mimeType: string
        byteSize: number
        createdAt: string
        referencedCount: number
        existsOnStorage: boolean
        status: 'OK' | 'MISSING_FILE' | 'UNREFERENCED' | 'MISSING_FILE_AND_UNREFERENCED'
        fixActions: Array<'DELETE_UNREFERENCED_ARTIFACT'>
      }>
      orphanStorageRows: Array<{
        storageKey: string
        byteSize: number
        campaignId: string | null
        campaignName: string | null
        fixActions: Array<'DELETE_ORPHAN_STORAGE_FILE'>
      }>
      documentRows: Array<{
        documentId: string
        campaignId: string
        campaignName: string | null
        title: string
        type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
        currentVersionId: string | null
        latestVersionId: string | null
        versionCount: number
        status: 'OK' | 'MISSING_CURRENT_VERSION' | 'EMPTY'
        fixActions: Array<'REPAIR_DOCUMENT_CURRENT_VERSION' | 'DELETE_EMPTY_DOCUMENT'>
      }>
    }>(`/api/admin/storage-audit${toQuery(query)}`)

  const applyStorageAuditFix = (payload: AdminStorageAuditFixPayload) =>
    request<{
      action: AdminStorageAuditFixPayload['action']
      targetId: string
      message: string
    }>('/api/admin/storage-audit/fix', {
      method: 'POST',
      body: payload,
    })

  return {
    getUsers,
    getUser,
    updateUser,
    getCampaigns,
    getCampaign,
    updateCampaign,
    getOverview,
    getUsage,
    getJobs,
    getActivity,
    getUsageCsvUrl,
    getJobsCsvUrl,
    getStorageAudit,
    applyStorageAuditFix,
  }
}
