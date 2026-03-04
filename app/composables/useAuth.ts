import { resolveAuthRedirectPath } from '~/utils/auth-redirect'

export const useAuth = () => {
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

  const logout = async (options?: { redirectTo?: string } | Event) => {
    await request('/api/auth/logout', { method: 'POST' })
    await session.clear()

    const redirectTo = options && 'redirectTo' in options ? options.redirectTo : null
    const redirect = redirectTo
      ? resolveAuthRedirectPath(redirectTo)
      : null
    if (!redirect) {
      await navigateTo('/login')
      return
    }

    await navigateTo({
      path: '/login',
      query: {
        redirect,
      },
    })
  }

  return {
    ...session,
    register,
    login,
    logout,
  }
}
