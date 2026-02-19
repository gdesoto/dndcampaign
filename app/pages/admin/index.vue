<script setup lang="ts">
definePageMeta({ layout: 'app' })

type AdminOverview = {
  totals: {
    users: number
    campaigns: number
    dau: number
    wau: number
  }
}

const isDev = import.meta.dev
const admin = useAdmin()

const { data: overview, pending, error, refresh } = await useAsyncData<AdminOverview>(
  'admin-overview-home',
  () => admin.getOverview() as Promise<AdminOverview>
)

const adminBreadcrumbItems = [{ label: 'Admin' }]
</script>

<template>
  <UPage>
    <UPageHeader headline="Admin" title="System administration">
      <template #default>
        <UBreadcrumb :items="adminBreadcrumbItems" />
      </template>
    </UPageHeader>

    <UMain>
      <div class="space-y-6">
        <div class="grid gap-4 md:grid-cols-3">
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Total users</p>
            <p class="mt-2 text-2xl font-semibold">{{ overview?.totals?.users ?? '-' }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Total campaigns</p>
            <p class="mt-2 text-2xl font-semibold">{{ overview?.totals?.campaigns ?? '-' }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">DAU / WAU</p>
            <p class="mt-2 text-2xl font-semibold">
              {{ overview?.totals?.dau ?? '-' }} / {{ overview?.totals?.wau ?? '-' }}
            </p>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Admin areas</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-4">
            <UButton to="/admin/users" variant="outline" icon="i-lucide-users">Manage users</UButton>
            <UButton to="/admin/campaigns" variant="outline" icon="i-lucide-flag">Manage campaigns</UButton>
            <UButton to="/admin/analytics" variant="outline" icon="i-lucide-chart-column">View analytics</UButton>
            <UButton to="/admin/activity" variant="outline" icon="i-lucide-scroll-text">Activity log</UButton>
            <UButton
              v-if="isDev"
              to="/admin/dev-tools"
              variant="outline"
              icon="i-lucide-wrench"
            >
              Dev Tools
            </UButton>
          </div>
        </UCard>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Unable to load overview"
          :description="(error as Error).message || 'Try again.'"
        />

        <div class="flex">
          <UButton :loading="pending" variant="outline" @click="() => refresh()">Refresh overview</UButton>
        </div>
      </div>
    </UMain>
  </UPage>
</template>
