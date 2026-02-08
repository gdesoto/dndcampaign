<script setup lang="ts">
const { user, logout } = useAuth()
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
  () => request<CampaignNavItem[]>('/api/campaigns')
)

const topNavItems = computed(() => [
  { label: 'Home', to: '/' },
  { label: 'Campaigns', to: '/campaigns' },
  { label: 'Characters', to: '/characters' },
])
const { showCampaignSelect, campaignOptions, selectedCampaignId } = useCampaignSelector(
  route,
  router,
  campaigns
)

const profileMenuItems = computed(() => [
  [
    {
      label: user.value?.email || 'Account',
      type: 'label',
    },
  ],
  [
    { label: 'Settings', icon: 'i-lucide-cog', to: '/settings' },
    { label: 'Logout', icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
])
</script>

<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise"></div>
    <div class="theme-overlay theme-overlay-pattern"></div>

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
          <UNavigationMenu class="w-full justify-center" :items="topNavItems" />
          <USelectMenu
            v-if="showCampaignSelect"
            v-model="selectedCampaignId"
            value-key="id"
            label-key="label"
            :items="campaignOptions"
            placeholder="Select campaign"
            size="sm"
            class="w-52"
          />
        </div>
      </template>
        <template #right>
          <div class="theme-text-muted flex flex-wrap items-center gap-3 text-xs">
            <UButton size="sm" color="secondary" variant="ghost" class="theme-pill" @click="toggleColorMode">
              <UIcon name="i-heroicons-moon" class="h-4 w-4" />
              <ClientOnly>
                <span class="ml-2 uppercase tracking-[0.3em]">{{ colorModeLabel }}</span>
                <template #fallback>
                  <span class="ml-2 uppercase tracking-[0.3em]">System</span>
                </template>
              </ClientOnly>
            </UButton>
            <UDropdownMenu :items="profileMenuItems">
              <UButton size="sm" color="primary" variant="ghost" class="theme-pill">
                <UIcon name="i-heroicons-user-circle" class="h-4 w-4" />
                <span class="ml-2 hidden uppercase tracking-[0.3em] md:inline">Profile</span>
              </UButton>
            </UDropdownMenu>
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

      <ClientOnly>
        <GlobalMediaPlayer />
      </ClientOnly>
    </div>
  </div>
</template>
