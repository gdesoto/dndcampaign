<script setup lang="ts">
definePageMeta({ layout: 'app' })

const admin = useAdmin()

type AdminOverview = {
  totals: {
    users: number
    campaigns: number
    dau: number
    wau: number
  }
}

const { data: overview, pending, error, refresh } = await useAsyncData<AdminOverview>('admin-overview-home', () =>
  admin.getOverview() as Promise<AdminOverview>
)
</script>

<template>
  <UPage>
    <UHeader>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Admin</p>
        <h1 class="mt-2 text-2xl font-semibold">System administration</h1>
      </div>
    </UHeader>

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

          <div class="grid gap-3 md:grid-cols-3">
            <UButton to="/admin/users" variant="outline" icon="i-lucide-users">Manage users</UButton>
            <UButton to="/admin/campaigns" variant="outline" icon="i-lucide-flag">Manage campaigns</UButton>
            <UButton to="/admin/analytics" variant="outline" icon="i-lucide-chart-column">View analytics</UButton>
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
