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
const campaignId = computed(() => route.params.campaignId as string | undefined)

const navLinks = computed(() => {
  const base = campaignId.value ? `/campaigns/${campaignId.value}` : '/campaigns'
  const links = [
    { label: 'All Campaigns', to: '/campaigns' },
    { label: 'Overview', to: base, requiresCampaign: true },
    { label: 'Sessions', to: `${base}/sessions`, requiresCampaign: true },
    { label: 'Glossary', to: `${base}/glossary`, requiresCampaign: true },
    { label: 'Quests', to: `${base}/quests`, requiresCampaign: true },
    { label: 'Milestones', to: `${base}/milestones`, requiresCampaign: true },
    { label: 'Settings', to: '/settings', requiresCampaign: false },
  ]
  return links.filter((link) => !link.requiresCampaign || campaignId.value)
})
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
              <div class="font-display text-lg tracking-[0.2em] uppercase">Campaign Desk</div>
              <div class="text-xs italic text-[color:var(--theme-text-soft)]">
                Where ancient vellum meets evergreen trails
              </div>
            </div>
          </div>
        </template>
        <template #default>
          <span class="text-xs uppercase tracking-[0.4em] text-[color:var(--theme-text-muted)]">Dungeon Master Vault</span>
        </template>
        <template #right>
          <div class="flex flex-wrap items-center gap-3 text-xs text-[color:var(--theme-text-muted)]">
            <UButton size="sm" color="secondary" variant="ghost" class="theme-pill" @click="toggleColorMode">
              <UIcon name="i-heroicons-moon" class="h-4 w-4" />
              <span class="ml-2 uppercase tracking-[0.3em]">{{ colorModeLabel }}</span>
            </UButton>
            <span v-if="user?.email" class="hidden text-[color:var(--theme-text-muted)] md:inline">
              {{ user.email }}
            </span>
            <UButton size="sm" color="primary" variant="ghost" class="theme-pill" @click="logout">
              Logout
            </UButton>
          </div>
        </template>
      </UHeader>

      <UMain>
        <div class="mx-auto max-w-6xl px-6 pb-16 pt-24">
          <UPage :ui="{ root: 'flex flex-col lg:grid lg:grid-cols-12 lg:gap-10', left: 'lg:col-span-3', center: 'lg:col-span-9' }">
            <template #left>
              <UCard class="sticky top-24 h-fit theme-reveal" :ui="{ body: 'p-4' }">
                <div class="font-display text-sm tracking-[0.4em] uppercase text-[color:var(--theme-accent)]">
                  Navigation
                </div>
                <nav class="mt-4 space-y-2 text-sm">
                  <NuxtLink
                    v-for="link in navLinks"
                    :key="link.label"
                    :to="link.to"
                    class="theme-nav-link flex items-center justify-between rounded-2xl px-4 py-3"
                  >
                    <span>{{ link.label }}</span>
                    <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-[color:var(--theme-accent)]" />
                  </NuxtLink>
                </nav>
                <p v-if="!campaignId" class="mt-4 text-xs text-[color:var(--theme-text-muted)]">
                  Select a campaign to unlock more sections.
                </p>
              </UCard>
            </template>

            <div class="px-2 py-6">
              <slot />
            </div>
          </UPage>
        </div>
      </UMain>
    </div>
  </div>
</template>
