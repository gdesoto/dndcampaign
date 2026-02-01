<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string | undefined)

const navLinks = computed(() => {
  const base = campaignId.value ? `/campaigns/${campaignId.value}` : '/campaigns'
  return [
    { label: 'All Campaigns', to: '/campaigns' },
    { label: 'Overview', to: base },
    { label: 'Glossary', to: `${base}/glossary` },
    { label: 'Quests', to: `${base}/quests` },
    { label: 'Milestones', to: `${base}/milestones` },
    { label: 'Sessions', to: `${base}/sessions` },
    { label: 'Settings', to: campaignId.value ? `${base}/settings` : '/settings' },
  ]
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="flex min-h-screen">
      <aside class="w-64 border-r border-slate-800 bg-slate-950 px-5 py-8">
        <div class="mb-8">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500">DM Vault</p>
          <h1 class="mt-2 text-xl font-semibold">Campaign Desk</h1>
        </div>

        <nav class="space-y-2">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.label"
            :to="link.to"
            class="block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </aside>

      <div class="flex-1">
        <header class="flex items-center justify-between border-b border-slate-800 px-8 py-5">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Campaigns</p>
            <h2 class="mt-1 text-lg font-semibold">Dashboard</h2>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-300">
            <span v-if="user?.email">{{ user.email }}</span>
            <UButton size="sm" color="gray" variant="ghost" @click="logout">
              Logout
            </UButton>
          </div>
        </header>

        <main class="px-8 py-8">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
