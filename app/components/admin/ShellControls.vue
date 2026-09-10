<script setup lang="ts">
const { user, logout } = useAuth()
const account = computed(() => user.value as { name?: string; email?: string; avatarUrl?: string } | null)
const colorMode = useColorMode()
const appearances = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' },
]
const appearanceIcon = computed(() => appearances.find(item => item.value === colorMode.preference)?.icon || 'i-lucide-monitor')
const appearanceMenu = computed(() => appearances.map(item => ({
  label: item.label, icon: item.icon, type: 'checkbox' as const, checked: colorMode.preference === item.value,
  onSelect: () => { colorMode.preference = item.value },
})))
const accountMenu = computed(() => [
  [{ label: account.value?.email || 'Account', type: 'label' as const }],
  [{ label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }],
  [{ label: 'Logout', icon: 'i-lucide-log-out', onSelect: () => logout() }],
])
</script>

<template>
  <div class="flex items-center gap-1 sm:gap-2">
    <ClientOnly>
      <UDropdownMenu :items="appearanceMenu"><UTooltip text="Appearance"><UButton :icon="appearanceIcon" aria-label="Appearance" color="neutral" variant="ghost" size="md" /></UTooltip></UDropdownMenu>
      <template #fallback><UButton icon="i-lucide-monitor" aria-label="Appearance" disabled color="neutral" variant="ghost" size="md" /></template>
    </ClientOnly>
    <UDropdownMenu :items="accountMenu"><UButton color="neutral" variant="ghost" aria-label="Account menu" size="md"><UAvatar :src="account?.avatarUrl" :alt="account?.name || 'Administrator'" size="2xs" /><span class="hidden max-w-36 truncate sm:block">{{ account?.name || 'Account' }}</span><UIcon name="i-lucide-chevron-down" class="size-4" aria-hidden="true" /></UButton></UDropdownMenu>
  </div>
</template>
