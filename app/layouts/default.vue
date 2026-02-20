<script setup lang="ts">
const { user, loggedIn, logout } = useAuth()
const currentUser = computed(
  () => (user.value as { email?: string; systemRole?: 'USER' | 'SYSTEM_ADMIN' } | null) || null
)
const colorMode = useColorMode()
type ThemePreference = 'system' | 'light' | 'dark'
const colorModeLabel = computed(() => {
  if (colorMode.preference === 'system') return 'System'
  return colorMode.preference === 'dark' ? 'Dark' : 'Light'
})
const themeIcon = computed(() => {
  if (colorMode.preference === 'light') return 'i-lucide-sun'
  if (colorMode.preference === 'dark') return 'i-lucide-moon'
  return colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'
})
const setColorMode = (preference: ThemePreference) => {
  colorMode.preference = preference as typeof colorMode.preference
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

const themeMenuItems = computed(() => [
  [
    {
      label: 'System',
      icon: colorMode.preference === 'system' ? 'i-lucide-check' : 'i-lucide-monitor',
      onSelect: () => setColorMode('system'),
    },
    {
      label: 'Light',
      icon: colorMode.preference === 'light' ? 'i-lucide-check' : 'i-lucide-sun',
      onSelect: () => setColorMode('light'),
    },
    {
      label: 'Dark',
      icon: colorMode.preference === 'dark' ? 'i-lucide-check' : 'i-lucide-moon',
      onSelect: () => setColorMode('dark'),
    },
  ],
])

const compactAccountMenuItems = computed(() => [
  [
    {
      label: 'System',
      icon: colorMode.preference === 'system' ? 'i-lucide-check' : 'i-lucide-monitor',
      onSelect: () => setColorMode('system'),
    },
    {
      label: 'Light',
      icon: colorMode.preference === 'light' ? 'i-lucide-check' : 'i-lucide-sun',
      onSelect: () => setColorMode('light'),
    },
    {
      label: 'Dark',
      icon: colorMode.preference === 'dark' ? 'i-lucide-check' : 'i-lucide-moon',
      onSelect: () => setColorMode('dark'),
    },
  ],
  [
    {
      label: `Current: ${colorModeLabel.value}`,
      type: 'label',
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
              <div class="hidden md:flex items-center gap-2">
                <UTooltip text="Theme">
                  <UDropdownMenu :items="themeMenuItems">
                    <UButton size="lg" color="neutral" variant="subtle" class="theme-pill" aria-label="Theme selector">
                      <ClientOnly>
                        <UIcon :name="themeIcon" class="h-5 w-5" />
                        <template #fallback>
                          <UIcon name="i-lucide-monitor" class="h-5 w-5" />
                        </template>
                      </ClientOnly>
                    </UButton>
                  </UDropdownMenu>
                </UTooltip>

                <UTooltip text="Profile">
                  <UDropdownMenu :items="profileMenuItems">
                    <UButton size="lg" color="neutral" variant="subtle" class="theme-pill" aria-label="Profile menu">
                      <UIcon name="i-heroicons-user-circle" class="h-5 w-5" />
                    </UButton>
                  </UDropdownMenu>
                </UTooltip>
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
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Theme</p>
              <div class="grid grid-cols-3 gap-2">
                <UButton size="sm" color="neutral" variant="subtle" class="theme-pill" @click="setColorMode('system')">
                  System
                </UButton>
                <UButton size="sm" color="neutral" variant="subtle" class="theme-pill" @click="setColorMode('light')">
                  Light
                </UButton>
                <UButton size="sm" color="neutral" variant="subtle" class="theme-pill" @click="setColorMode('dark')">
                  Dark
                </UButton>
              </div>
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

      <UMain class="w-full px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <slot />
      </UMain>
    </div>
  </div>
</template>
