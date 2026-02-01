export const useAuthStore = defineStore('auth', () => {
  const session = useUserSession()
  const { request } = useApi()

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
    login,
    logout,
  }
})
