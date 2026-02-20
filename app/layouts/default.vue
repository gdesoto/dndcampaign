<script setup lang="ts">
const { user, loggedIn, logout } = useAuth()
const currentUser = computed(
  () => (user.value as { email?: string; systemRole?: 'USER' | 'SYSTEM_ADMIN' } | null) || null
)
const colorMode = useColorMode()
const colorModeLabel = computed(() => {
  if (colorMode.preference === 'system') return 'System'
  return colorMode.preference === 'dark' ? 'Dark' : 'Light'
})
const toggleColorMode = () => {
  const order = ['system', 'light', 'dark']
  const current = colorMode.preference || 'system'
  const next = order[(order.indexOf(current) + 1) % order.length]
  colorMode.preference = next as typeof colorMode.preference
}
const route = useRoute()
const router = useRouter()

type CampaignNavItem = {
  id: string
  name: string
}

const { request } = useApi()
const { data: campaigns } = await useAsyncData(
  'nav-campaigns',
  async () => {
    if (!loggedIn.value) return []
    return await request<CampaignNavItem[]>('/api/campaigns')
  },
  { default: () => [], watch: [loggedIn] }
)

const topNavItems = computed(() => {
  const items = [{ label: 'Home', to: '/' }]

  if (loggedIn.value) {
    items.push(
      { label: 'Campaigns', to: '/campaigns' },
      { label: 'Characters', to: '/characters' }
    )
    if (currentUser.value?.systemRole === 'SYSTEM_ADMIN') {
      items.push({ label: 'Admin', to: '/admin' })
    }
    return items
  }

  items.push({ label: 'Public', to: '/public' })
  return items
})

const { showCampaignSelect, campaignOptions, selectedCampaignId } = useCampaignSelector(
  route,
  router,
  campaigns
)

const profileMenuItems = computed(() => [
  [
    {
      label: currentUser.value?.email || 'Account',
      type: 'label',
    },
  ],
  [
    ...(currentUser.value?.systemRole === 'SYSTEM_ADMIN'
      ? [{ label: 'Admin', icon: 'i-lucide-shield-check', to: '/admin' }]
      : []),
    { label: 'Settings', icon: 'i-lucide-cog', to: '/settings' },
    { label: 'Logout', icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
])

const compactAccountMenuItems = computed(() => [
  [
    {
      label: `Theme: ${colorModeLabel.value}`,
      icon: 'i-heroicons-moon',
      onSelect: () => toggleColorMode(),
    },
  ],
  ...profileMenuItems.value,
])
</script>

<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise"/>
    <div class="theme-overlay theme-overlay-pattern"/>

    <div class="relative z-10">
      <UHeader class="theme-header fixed left-0 right-0 top-0 z-20">
        <template #left>
          <div class="flex items-center gap-4">
            <div class="theme-seal flex h-11 w-11 items-center justify-center rounded-full text-amber-100">
              <UIcon name="i-heroicons-sparkles" class="h-5 w-5" />
            </div>
            <div>
              <div class="font-display text-lg tracking-[0.2em] uppercase">DM Vault</div>
              <div class="theme-text-muted text-xs uppercase tracking-[0.4em]">
                Campaign Desk
              </div>
            </div>
          </div>
        </template>
      <template #default>
        <div class="flex w-full items-center justify-center gap-4">
          <USelectMenu
            v-if="loggedIn && showCampaignSelect"
            v-model="selectedCampaignId"
            value-key="id"
            label-key="label"
            :items="campaignOptions"
            placeholder="Select campaign"
            size="sm"
            icon="i-lucide-sword"
            class="w-60 shrink-0"
          />
          <UNavigationMenu class="min-w-0 flex-1 justify-center" :items="topNavItems" />
        </div>
      </template>
        <template #right>
          <div class="theme-text-muted flex items-center gap-3 text-xs">
            <template v-if="loggedIn">
              <div class="hidden md:flex items-center gap-3">
                <UButton size="sm" color="secondary" variant="ghost" class="theme-pill" @click="toggleColorMode">
                  <UIcon name="i-heroicons-moon" class="h-4 w-4" />
                  <ClientOnly>
                    <span class="ml-2 hidden uppercase tracking-[0.3em] xl:inline">{{ colorModeLabel }}</span>
                    <template #fallback>
                      <span class="ml-2 hidden uppercase tracking-[0.3em] xl:inline">System</span>
                    </template>
                  </ClientOnly>
                </UButton>
                <UDropdownMenu :items="profileMenuItems">
                  <UButton size="sm" color="primary" variant="ghost" class="theme-pill">
                    <UIcon name="i-heroicons-user-circle" class="h-4 w-4" />
                    <span class="ml-2 hidden uppercase tracking-[0.3em] lg:inline">Profile</span>
                  </UButton>
                </UDropdownMenu>
              </div>

              <div class="md:hidden">
                <UDropdownMenu :items="compactAccountMenuItems">
                  <UButton size="sm" color="primary" variant="ghost" class="theme-pill" aria-label="Open account menu">
                    <UIcon name="i-lucide-ellipsis" class="h-4 w-4" />
                  </UButton>
                </UDropdownMenu>
              </div>
            </template>

            <template v-else>
              <UButton size="sm" color="primary" variant="ghost" class="theme-pill" to="/login">
                Login
              </UButton>
              <UButton size="sm" color="primary" class="theme-pill" to="/register">
                Register
              </UButton>
            </template>
          </div>
        </template>
        <template #body>
          <div class="space-y-4">
            <USelectMenu
              v-if="loggedIn && showCampaignSelect"
              v-model="selectedCampaignId"
              value-key="id"
              label-key="label"
              :items="campaignOptions"
              placeholder="Select campaign"
              size="sm"
              icon="i-lucide-sword"
              class="w-full"
            />

            <UNavigationMenu :items="topNavItems" orientation="vertical" class="-mx-2.5" />

            <div v-if="loggedIn" class="space-y-2 border-t border-default pt-3">
              <UButton size="sm" color="secondary" variant="ghost" block class="theme-pill" @click="toggleColorMode">
                <UIcon name="i-heroicons-moon" class="h-4 w-4" />
                <span class="ml-2 uppercase tracking-[0.2em]">Theme: {{ colorModeLabel }}</span>
              </UButton>
              <UButton size="sm" color="primary" variant="ghost" to="/settings" block class="theme-pill">
                Settings
              </UButton>
              <UButton size="sm" color="primary" variant="ghost" block class="theme-pill" @click="logout">
                Logout
              </UButton>
            </div>
          </div>
        </template>
      </UHeader>

      <UMain>
        <div class="mx-auto max-w-7xl px-6 pb-16 pt-24">
          <div class="px-2 py-6">
            <slot />
          </div>
        </div>
      </UMain>
    </div>
  </div>
</template>
