export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/', '/login', '/register']
  if (publicRoutes.includes(to.path) || to.path.startsWith('/public/')) {
    return
  }

  const { loggedIn, ready, fetch, user } = useUserSession()
  if (!ready.value) {
    await fetch()
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  const sessionUser = (user.value as { systemRole?: 'USER' | 'SYSTEM_ADMIN' } | null) || null
  if (to.path.startsWith('/admin') && sessionUser?.systemRole !== 'SYSTEM_ADMIN') {
    return navigateTo('/campaigns')
  }
})
