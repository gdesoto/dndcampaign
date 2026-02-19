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

export const useAdmin = () => {
  const { request } = useApi()

  const toQuery = (input: Record<string, string | number | undefined>) => {
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

  const getUsageCsvUrl = (query: AdminAnalyticsQuery = {}) =>
    `/api/admin/analytics/usage.csv${toQuery(query)}`
  const getJobsCsvUrl = (query: AdminAnalyticsQuery = {}) =>
    `/api/admin/analytics/jobs.csv${toQuery(query)}`

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
    getUsageCsvUrl,
    getJobsCsvUrl,
  }
}
