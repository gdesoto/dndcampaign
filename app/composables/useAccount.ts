type AccountProfile = {
  id: string
  email: string
  name: string
  systemRole: 'USER' | 'SYSTEM_ADMIN'
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type AccountSession = {
  id: string
  isCurrent: boolean
  userAgent: string | null
  ipAddress: string | null
  loggedInAt: string | null
  lastSeenAt: string
}

export const useAccount = () => {
  const { request } = useApi()
  const auth = useAuth()

  const getProfile = async () => request<{ profile: AccountProfile }>('/api/account/profile')

  const updateProfile = async (payload: { name?: string; avatarUrl?: string | null }) => {
    const response = await request<{ profile: AccountProfile }>('/api/account/profile', {
      method: 'PATCH',
      body: payload,
    })

    await auth.fetch()
    return response
  }

  const changeEmail = async (payload: { newEmail: string; password: string }) => {
    const response = await request<{ email: string }>('/api/account/change-email', {
      method: 'POST',
      body: payload,
    })

    await auth.fetch()
    return response
  }

  const changePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    return request<{ success: boolean }>('/api/account/change-password', {
      method: 'POST',
      body: payload,
    })
  }

  const listSessions = async () => request<{ sessions: AccountSession[] }>('/api/account/sessions')

  const revokeOtherSessions = async () => {
    return request<{ revokedSessions: number }>('/api/account/sessions/revoke-others', {
      method: 'POST',
    })
  }

  return {
    getProfile,
    updateProfile,
    changeEmail,
    changePassword,
    listSessions,
    revokeOtherSessions,
  }
}
