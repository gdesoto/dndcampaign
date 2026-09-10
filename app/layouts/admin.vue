<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { adminSections, getAdminSections } from '~/utils/admin-navigation'

const route = useRoute()
const open = ref(false)
const sections = getAdminSections(import.meta.dev)
const currentSection = computed(() => adminSections.find(section => section.to === route.path.replace(/\/$/, '')) || adminSections[0])
useHead(() => ({ title: currentSection.value.title + ' | Admin | DM Vault' }))
const breadcrumbs = computed(() => currentSection.value.to === '/admin'
  ? [{ label: 'Admin' }]
  : [{ label: 'Admin', to: '/admin' }, { label: currentSection.value.label }])
const navigation = computed<NavigationMenuItem[]>(() => {
  const groups = [...new Set(sections.map(section => section.group))]
  return groups.flatMap(group => [
    { label: group, type: 'label' as const },
    ...sections.filter(section => section.group === group).map(section => ({ label: section.label, to: section.to, icon: section.icon, exact: true })),
  ])
})
const workspaceLinks: NavigationMenuItem[] = [
  { label: 'Workspace', type: 'label' },
  { label: 'Home', to: '/', exact: true, icon: 'i-lucide-house' },
  { label: 'Campaign desk', to: '/campaigns', icon: 'i-lucide-swords' },
  { label: 'Characters', to: '/characters', icon: 'i-lucide-contact-round' },
  { label: 'Documentation', to: '/docs', icon: 'i-lucide-book-open' },
]
watch(() => route.fullPath, () => { open.value = false })
</script>

<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise" aria-hidden="true" />
    <div class="theme-overlay theme-overlay-pattern" aria-hidden="true" />
    <UDashboardGroup storage-key="dmvault-admin-dashboard" unit="rem" class="z-10 overflow-clip">
      <UDashboardSidebar id="dmvault-admin-sidebar" v-model:open="open" collapsible resizable :default-size="16" :min-size="14" :max-size="22" :collapsed-size="0" :menu="{ title: 'Admin navigation', description: 'Administration and workspace sections.' }" :ui="{ root: 'min-h-0 bg-default/80', header: 'border-b border-default', footer: 'border-t border-default' }">
        <template #header="{ collapsed }">
          <NuxtLink v-if="!collapsed" to="/admin" aria-label="DM Vault administration" class="flex min-w-0 items-center gap-3 rounded-md py-2 focus-visible:outline-2 focus-visible:outline-primary">
            <span class="theme-seal flex size-9 shrink-0 items-center justify-center rounded-full"><UIcon name="i-lucide-shield-check" class="size-5 text-inverted" aria-hidden="true" /></span>
            <span><span class="block font-display text-base tracking-[0.08em]">DM Vault</span><span class="type-label text-muted">Administration</span></span>
          </NuxtLink>
        </template>
        <template #default="{ collapsed }">
          <template v-if="!collapsed">
            <UNavigationMenu :items="navigation" orientation="vertical" highlight aria-label="Admin sections" class="w-full" :ui="{ link: 'min-h-11', linkLabel: 'font-display text-sm' }" />
            <UNavigationMenu :items="workspaceLinks" orientation="vertical" aria-label="Workspace navigation" class="mt-auto w-full border-t border-default pt-3" :ui="{ link: 'min-h-11' }" />
          </template>
        </template>
        <template #footer="{ collapsed }"><p v-if="!collapsed" class="flex items-center gap-2 py-1 text-xs text-muted"><UIcon name="i-lucide-shield" class="size-4" aria-hidden="true" /> System administrator</p></template>
      </UDashboardSidebar>
      <UDashboardPanel id="dmvault-admin-main" :ui="{ root: 'min-h-0', body: 'min-h-0 p-4 sm:p-6 lg:p-8' }">
        <template #header>
          <UDashboardNavbar :ui="{ root: 'theme-header gap-2 px-3 sm:px-6', left: 'min-w-0 flex-1' }">
            <template #left><UDashboardSidebarCollapse /><UBreadcrumb :items="breadcrumbs" class="min-w-0" /></template>
            <template #right><AdminShellControls /></template>
          </UDashboardNavbar>
        </template>
        <template #body><div class="mx-auto w-full min-w-0 max-w-screen-2xl"><slot /></div></template>
      </UDashboardPanel>
    </UDashboardGroup>
  </div>
</template>
