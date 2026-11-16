<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const base = computed(() => `/campaigns/${route.params.campaignId as string}/settings`)
const settingsNavigation = computed(() => [
  { label: 'General', icon: 'i-lucide-settings-2', to: base.value, exact: true },
  { label: 'Calendar', icon: 'i-lucide-calendar-days', to: `${base.value}/calendar` },
  { label: 'Members', icon: 'i-lucide-users', to: `${base.value}/members` },
  { label: 'Public access', icon: 'i-lucide-globe', to: `${base.value}/public` },
])
</script>

<template>
  <CampaignTemplatesList title="Campaign settings">
    <UNavigationMenu :items="settingsNavigation" aria-label="Campaign settings" class="w-full" />
    <NuxtPage />
  </CampaignTemplatesList>
</template>
