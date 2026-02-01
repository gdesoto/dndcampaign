export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/', '/login']
  if (publicRoutes.includes(to.path)) {
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
