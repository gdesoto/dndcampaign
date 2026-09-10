<script setup lang="ts">
import { getAdminSections } from '~/utils/admin-navigation'
definePageMeta({ layout: 'admin' })
type AdminOverview = { totals: { users: number; campaigns: number; dau: number; wau: number } }
const admin = useAdmin()
const sections = getAdminSections(import.meta.dev).filter(section => section.to !== '/admin')
const retained = useRetainedResource<AdminOverview | null>(() => 'admin-overview-home')
const { data: overview, pending, error, refresh } = await useAsyncData('admin-overview-home', () => retained.load(() => admin.getOverview() as Promise<AdminOverview | null>), { default: retained.get })
retained.seed(overview.value)
</script>

<template>
  <UPage>
    <UPageHeader title="System administration" description="Oversee your community, campaign activity, and the health of the vault.">
      <template #links><UButton icon="i-lucide-refresh-cw" :loading="pending" @click="() => refresh()">Refresh overview</UButton></template>
    </UPageHeader>
    <UPageBody>
      <SharedResourceState :pending="pending" :error="error" :has-data="Boolean(overview)" error-message="Unable to load the administration overview." @retry="refresh">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SharedStatCard label="Total users" :value="overview?.totals.users ?? '—'" icon="i-lucide-users" to="/admin/users" />
          <SharedStatCard label="Total campaigns" :value="overview?.totals.campaigns ?? '—'" icon="i-lucide-flag" to="/admin/campaigns" />
          <SharedStatCard label="Daily active users" :value="overview?.totals.dau ?? '—'" hint="Active in the last day" icon="i-lucide-activity" to="/admin/analytics" />
          <SharedStatCard label="Weekly active users" :value="overview?.totals.wau ?? '—'" hint="Active in the last week" icon="i-lucide-calendar-days" to="/admin/analytics" />
        </div>
      </SharedResourceState>
      <UCard>
        <template #header><h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-compass" class="size-5 text-primary" aria-hidden="true" /> Administration tools</h2></template>
        <div class="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          <NuxtLink v-for="section in sections" :key="section.to" :to="section.to" class="group flex min-w-0 gap-3 rounded-md border-b border-default px-2 py-5 transition-colors hover:bg-accented/40 focus-visible:outline-2 focus-visible:outline-primary">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UIcon :name="section.icon" class="size-5" aria-hidden="true" /></span>
            <span class="min-w-0 flex-1"><span class="type-record flex items-center justify-between gap-2 text-highlighted">{{ section.label }}<UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-muted group-hover:text-primary" aria-hidden="true" /></span><span class="mt-1 block text-sm text-muted">{{ section.description }}</span></span>
          </NuxtLink>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>
