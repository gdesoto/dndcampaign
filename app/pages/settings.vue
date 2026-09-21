<script setup lang="ts">
definePageMeta({ layout: 'default' })
const route = useRoute()
const isApiKeys = computed(() => route.path === '/settings/api-keys' || route.path.startsWith('/settings/api-keys/'))
const accountNavigation = [
  { label: 'Settings', icon: 'i-lucide-settings-2', to: '/settings', exact: true },
  { label: 'API keys', icon: 'i-lucide-key-round', to: '/settings/api-keys' },
]
</script>

<template>
  <UPage>
    <UPageHeader headline="Account" :title="isApiKeys ? 'API keys' : 'Settings'" :description="isApiKeys ? 'Create scoped keys for agents and integrations that need campaign access.' : undefined" />
    <UPageBody>
      <UNavigationMenu :items="accountNavigation" aria-label="Account settings" class="mb-6 w-full" />
      <NuxtPage />
    </UPageBody>
  </UPage>
</template>
