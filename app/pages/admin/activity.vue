<script setup lang="ts">
definePageMeta({ layout: 'default' })

const admin = useAdmin()

const filters = reactive({
  search: '',
  scope: 'all' as 'all' | 'CAMPAIGN' | 'ADMIN' | 'SYSTEM',
  action: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 50,
})

const {
  data: activityData,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () =>
    `admin-activity-${filters.search}-${filters.scope}-${filters.action}-${filters.from}-${filters.to}-${filters.page}-${filters.pageSize}`,
  () =>
    admin.getActivity({
      search: filters.search || undefined,
      scope: filters.scope,
      action: filters.action || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    })
)

const logs = computed(() => activityData.value?.logs || [])
const total = computed(() => activityData.value?.total || 0)

const columns = [
  { accessorKey: 'createdAt', header: 'Timestamp' },
  { accessorKey: 'scope', header: 'Scope' },
  { accessorKey: 'action', header: 'Action' },
  { accessorKey: 'actor', header: 'Actor' },
  { accessorKey: 'campaign', header: 'Campaign' },
  { accessorKey: 'summary', header: 'Summary' },
]

const tableRows = computed(() =>
  logs.value.map((log) => ({
    id: log.id,
    createdAt: new Date(log.createdAt).toLocaleString(),
    scope: log.scope,
    action: log.action,
    actor: log.actorUser ? `${log.actorUser.name} (${log.actorUser.email})` : 'System',
    campaign: log.campaign?.name || '-',
    summary: log.summary || '-',
  }))
)

const canGoPrevious = computed(() => filters.page > 1)
const canGoNext = computed(() => filters.page * filters.pageSize < total.value)

const applyFilters = async () => {
  filters.page = 1
  await refresh()
}

const goPrevious = async () => {
  if (!canGoPrevious.value) return
  filters.page -= 1
  await refresh()
}

const goNext = async () => {
  if (!canGoNext.value) return
  filters.page += 1
  await refresh()
}

const adminBreadcrumbItems = [
  { label: 'Admin', to: '/admin' },
  { label: 'Activity log' },
]
</script>

<template>
  <UPage>
    <UPageHeader headline="Admin" title="Activity log">
      <template #default>
        <UBreadcrumb :items="adminBreadcrumbItems" />
      </template>
    </UPageHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Filter activity</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-3">
            <UInput v-model="filters.search" placeholder="Search action, actor, summary, campaign" />
            <USelect
              v-model="filters.scope"
              :items="[
                { label: 'All scopes', value: 'all' },
                { label: 'Campaign', value: 'CAMPAIGN' },
                { label: 'Admin', value: 'ADMIN' },
                { label: 'System', value: 'SYSTEM' },
              ]"
            />
            <UInput v-model="filters.action" placeholder="Exact action (optional)" />
            <UInput v-model="filters.from" type="date" placeholder="From (YYYY-MM-DD)" />
            <UInput v-model="filters.to" type="date" placeholder="To (YYYY-MM-DD)" />
            <UButton :loading="pending" @click="applyFilters">Apply filters</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Entries</h2>
              <UBadge color="neutral" variant="subtle">{{ total }} total</UBadge>
            </div>
          </template>

          <UTable :data="tableRows" :columns="columns" :loading="pending" empty="No activity logs found" />
          <p v-if="error" class="mt-3 text-sm text-error">{{ (error as Error).message }}</p>

          <div class="mt-4 flex items-center justify-end gap-2">
            <UButton variant="outline" :disabled="!canGoPrevious" @click="goPrevious">Previous</UButton>
            <UBadge color="neutral" variant="soft">Page {{ filters.page }}</UBadge>
            <UButton variant="outline" :disabled="!canGoNext" @click="goNext">Next</UButton>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
