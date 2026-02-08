<script setup lang="ts">
definePageMeta({ layout: 'app' })

type CampaignShell = {
  id: string
  name: string
  system?: string | null
  dungeonMasterName?: string | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

const { data: campaign, pending, error, refresh } = await useAsyncData(
  () => `campaign-shell-${campaignId.value}`,
  () => request<CampaignShell>(`/api/campaigns/${campaignId.value}`)
)

const navItems = computed(() => [
  { label: 'Overview', to: `/campaigns/${campaignId.value}`, icon: 'i-lucide-layout-dashboard' },
  { label: 'Characters', to: `/campaigns/${campaignId.value}/characters`, icon: 'i-lucide-users' },
  { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions`, icon: 'i-lucide-calendar-days' },
  { label: 'Quests', to: `/campaigns/${campaignId.value}/quests`, icon: 'i-lucide-scroll-text' },
  { label: 'Milestones', to: `/campaigns/${campaignId.value}/milestones`, icon: 'i-lucide-flag' },
  { label: 'Glossary', to: `/campaigns/${campaignId.value}/glossary`, icon: 'i-lucide-book-open-text' },
  { label: 'Settings', to: `/campaigns/${campaignId.value}/settings`, icon: 'i-lucide-settings' },
])

const sectionTitle = computed(() => {
  const path = route.path
  if (path.endsWith('/characters')) return 'Characters'
  if (path.endsWith('/sessions')) return 'Sessions'
  if (path.includes('/sessions/')) return 'Session details'
  if (path.endsWith('/quests')) return 'Quests'
  if (path.endsWith('/milestones')) return 'Milestones'
  if (path.endsWith('/glossary')) return 'Glossary'
  if (path.endsWith('/settings')) return 'Settings'
  return 'Overview'
})

const breadcrumbItems = computed(() => {
  const rootItems = [
    { label: 'Campaigns', to: '/campaigns' },
    { label: campaign.value?.name || 'Campaign', to: `/campaigns/${campaignId.value}` },
  ]

  const path = route.path
  if (path === `/campaigns/${campaignId.value}`) {
    return rootItems
  }
  if (path.includes(`/campaigns/${campaignId.value}/sessions/`)) {
    return [
      ...rootItems,
      { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
      { label: 'Session details' },
    ]
  }
  return [...rootItems, { label: sectionTitle.value }]
})

useSeoMeta({
  title: () => {
    const campaignName = campaign.value?.name || 'Campaign'
    return `${sectionTitle.value} | ${campaignName} | DM Vault`
  },
  description: () => {
    const campaignName = campaign.value?.name || 'campaign'
    return `Manage ${sectionTitle.value.toLowerCase()} for ${campaignName}.`
  },
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="pending" class="space-y-3">
      <UCard class="h-24 animate-pulse" />
      <UCard class="h-16 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load campaign shell.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else-if="campaign" class="space-y-4">
      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Campaign</p>
            <h1 class="mt-1 text-2xl font-semibold">{{ campaign.name }}</h1>
            <p class="text-sm text-muted">
              <span>{{ campaign.system || 'System not set' }}</span>
              <span v-if="campaign.dungeonMasterName" class="mx-2">•</span>
              <span v-if="campaign.dungeonMasterName">DM: {{ campaign.dungeonMasterName }}</span>
            </p>
          </div>
          <UBadge variant="soft" color="secondary" size="sm">
            {{ sectionTitle }}
          </UBadge>
        </div>
      </UCard>

      <UCard>
        <UBreadcrumb :items="breadcrumbItems" />
      </UCard>

      <UCard>
        <UNavigationMenu :items="navItems" class="w-full" />
      </UCard>

      <NuxtPage />
    </div>
  </div>
</template>
