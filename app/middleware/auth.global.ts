export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/', '/login', '/register']
  if (publicRoutes.includes(to.path) || to.path.startsWith('/public/')) {
    return
  }

  const { loggedIn, ready, fetch } = useUserSession()
  if (!ready.value) {
    await fetch()
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
