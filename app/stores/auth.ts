export const useAuthStore = defineStore('auth', () => {
  const session = useUserSession()
  const { request } = useApi()

  const register = async (payload: {
    name: string
    email: string
    password: string
    termsAccepted: boolean
  }) => {
    await request('/api/auth/register', {
      method: 'POST',
      body: payload,
    })
    await session.fetch()
  }

  const login = async (email: string, password: string) => {
    await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    await session.fetch()
  }

  const logout = async () => {
    await request('/api/auth/logout', { method: 'POST' })
    await session.clear()
    await navigateTo('/login')
  }

  return {
    ...session,
    register,
    login,
    logout,
  }
})
