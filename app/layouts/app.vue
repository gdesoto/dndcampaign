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
    { label: 'Glossary', to: `${base}/glossary`, requiresCampaign: true },
    { label: 'Quests', to: `${base}/quests`, requiresCampaign: true },
    { label: 'Milestones', to: `${base}/milestones`, requiresCampaign: true },
    { label: 'Sessions', to: `${base}/sessions`, requiresCampaign: true },
    { label: 'Settings', to: '/settings', requiresCampaign: false },
  ]
  return links.filter((link) => !link.requiresCampaign || campaignId.value)
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <UHeader>
      <template #left>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-amber-500" />
          <span class="text-sm font-semibold">Campaign Desk</span>
        </div>
      </template>
      <template #default>
        <span class="text-md uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">Dungeon Master Vault</span>
      </template>
      <template #right>
        <div class="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <UButton
            size="sm"
            color="gray"
            variant="ghost"
            @click="toggleColorMode"
          >
            <UIcon name="i-heroicons-moon" class="h-4 w-4" />
            <span class="ml-2">{{ colorModeLabel }}</span>
          </UButton>
          <span v-if="user?.email">{{ user.email }}</span>
          <UButton size="sm" color="gray" variant="ghost" @click="logout">
            Logout
          </UButton>
        </div>
      </template>
    </UHeader>

    <UMain>
      <UPage>
        <template #left>
          <aside class="border-r border-slate-200 bg-white px-5 py-8 dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-[var(--ui-header-height)] lg:h-[calc(100vh-var(--ui-header-height))]">
            <div class="mb-8">
              <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">DM Vault</p>
              <h1 class="mt-2 text-xl font-semibold">Campaign Desk</h1>
            </div>

            <nav class="space-y-2">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.label"
              :to="link.to"
              class="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
          <p v-if="!campaignId" class="mt-4 text-xs text-slate-500 dark:text-slate-500">
            Select a campaign to unlock more sections.
          </p>
          </aside>
        </template>

        <div class="px-8 py-8">
          <slot />
        </div>
      </UPage>
    </UMain>
  </div>
</template>
