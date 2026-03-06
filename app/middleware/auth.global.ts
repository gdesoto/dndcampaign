export default defineNuxtRouteMiddleware(async (to) => {
  const isDocsRoute = to.path === '/docs' || to.path.startsWith('/docs/')
  if (import.meta.dev && isDocsRoute) {
    return
  }

  const publicRoutes = ['/', '/login', '/register']
  if (publicRoutes.includes(to.path) || to.path.startsWith('/public/')) {
    return
  }

  const { loggedIn, ready, fetch, user } = useUserSession()
  if (!ready.value) {
    await fetch()
  }

  if (!loggedIn.value) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    })
  }

  const sessionUser = (user.value as { systemRole?: 'USER' | 'SYSTEM_ADMIN' } | null) || null
  if (to.path.startsWith('/admin') && sessionUser?.systemRole !== 'SYSTEM_ADMIN') {
    return navigateTo('/campaigns')
  }
})
