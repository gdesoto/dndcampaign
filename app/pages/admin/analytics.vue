<script setup lang="ts">
definePageMeta({ layout: 'app' })

const admin = useAdmin()

type AnalyticsOverview = {
  totals: {
    users: number
    campaigns: number
    dau: number
    wau: number
  }
}

type AnalyticsUsage = {
  campaignUsage: Array<{
    campaignId: string
    campaignName: string
    ownerEmail: string
    memberCount: number
    sessionCount: number
    storageBytes: number
  }>
}

type AnalyticsJobs = {
  transcription: {
    total: number
    completed: number
    successRate: number
  }
  summary: {
    total: number
    completed: number
    successRate: number
  }
  daily: Array<{
    date: string
    transcriptionCompleted: number
    transcriptionFailed: number
    summaryCompleted: number
    summaryFailed: number
  }>
}

const filters = reactive({
  from: '',
  to: '',
})

const tabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Usage', value: 'usage' },
  { label: 'Jobs', value: 'jobs' },
]

const activeTab = ref<'overview' | 'usage' | 'jobs'>('overview')

const {
  data: overview,
  pending: overviewPending,
  refresh: refreshOverview,
} = await useAsyncData('admin-analytics-overview', () => admin.getOverview())

const {
  data: usage,
  pending: usagePending,
  refresh: refreshUsage,
} = await useAsyncData('admin-analytics-usage', () =>
  admin.getUsage({
    from: filters.from || undefined,
    to: filters.to || undefined,
    campaignLimit: 100,
  })
)

const {
  data: jobs,
  pending: jobsPending,
  refresh: refreshJobs,
} = await useAsyncData('admin-analytics-jobs', () =>
  admin.getJobs({
    from: filters.from || undefined,
    to: filters.to || undefined,
  })
)

const overviewData = computed(() => (overview.value || { totals: { users: 0, campaigns: 0, dau: 0, wau: 0 } }) as AnalyticsOverview)
const usageData = computed(() => (usage.value || { campaignUsage: [] }) as AnalyticsUsage)
const jobsData = computed(() => (jobs.value || { transcription: { total: 0, completed: 0, successRate: 0 }, summary: { total: 0, completed: 0, successRate: 0 }, daily: [] }) as AnalyticsJobs)

const refreshActive = async () => {
  if (activeTab.value === 'overview') await refreshOverview()
  if (activeTab.value === 'usage') await refreshUsage()
  if (activeTab.value === 'jobs') await refreshJobs()
}

const usageCsvUrl = computed(() =>
  admin.getUsageCsvUrl({
    from: filters.from || undefined,
    to: filters.to || undefined,
    campaignLimit: 100,
  })
)

const jobsCsvUrl = computed(() =>
  admin.getJobsCsvUrl({
    from: filters.from || undefined,
    to: filters.to || undefined,
  })
)
</script>

<template>
  <UPage>
    <UHeader>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Admin</p>
        <h1 class="mt-2 text-2xl font-semibold">Analytics and reporting</h1>
      </div>
    </UHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Analytics range</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <UInput v-model="filters.from" type="date" placeholder="From (YYYY-MM-DD)" />
            <UInput v-model="filters.to" type="date" placeholder="To (YYYY-MM-DD)" />
            <UButton
              :loading="overviewPending || usagePending || jobsPending"
              @click="refreshActive"
            >
              Refresh active tab
            </UButton>
          </div>
        </UCard>

        <UCard>
          <UTabs v-model="activeTab" :items="tabs" :content="false" />
        </UCard>

        <div v-if="activeTab === 'overview'" class="grid gap-4 md:grid-cols-3">
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Total users</p>
            <p class="mt-2 text-2xl font-semibold">{{ overviewData.totals.users }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Total campaigns</p>
            <p class="mt-2 text-2xl font-semibold">{{ overviewData.totals.campaigns }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">DAU / WAU</p>
            <p class="mt-2 text-2xl font-semibold">{{ overviewData.totals.dau }} / {{ overviewData.totals.wau }}</p>
          </UCard>
        </div>

        <UCard v-else-if="activeTab === 'usage'">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Campaign usage</h2>
              <UButton :to="usageCsvUrl" external variant="outline" icon="i-lucide-download">
                Export CSV
              </UButton>
            </div>
          </template>

          <div v-if="usagePending" class="text-sm text-muted">Loading usage metrics...</div>
          <div v-else-if="!usageData.campaignUsage.length" class="text-sm text-muted">No campaign usage data.</div>
          <div v-else class="space-y-2">
            <div
              v-for="row in usageData.campaignUsage"
              :key="row.campaignId"
              class="rounded-md border border-default bg-elevated/20 p-3 text-sm"
            >
              <p class="font-medium">{{ row.campaignName }}</p>
              <p class="text-xs text-muted">
                Owner: {{ row.ownerEmail }} · Members: {{ row.memberCount }} · Sessions: {{ row.sessionCount }} · Storage: {{ row.storageBytes }} bytes
              </p>
            </div>
          </div>
        </UCard>

        <UCard v-else>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Job success rates</h2>
              <UButton :to="jobsCsvUrl" external variant="outline" icon="i-lucide-download">
                Export CSV
              </UButton>
            </div>
          </template>

          <div v-if="jobsPending" class="text-sm text-muted">Loading job metrics...</div>
          <div v-else class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <UCard>
                <p class="text-xs uppercase tracking-wide text-muted">Transcription success</p>
                <p class="mt-2 text-2xl font-semibold">{{ (jobsData.transcription.successRate * 100).toFixed(1) }}%</p>
                <p class="text-xs text-muted">{{ jobsData.transcription.completed }} completed / {{ jobsData.transcription.total }} total</p>
              </UCard>
              <UCard>
                <p class="text-xs uppercase tracking-wide text-muted">Summary success</p>
                <p class="mt-2 text-2xl font-semibold">{{ (jobsData.summary.successRate * 100).toFixed(1) }}%</p>
                <p class="text-xs text-muted">{{ jobsData.summary.completed }} completed / {{ jobsData.summary.total }} total</p>
              </UCard>
            </div>

            <div v-if="jobsData.daily.length" class="space-y-2">
              <div
                v-for="row in jobsData.daily"
                :key="row.date"
                class="rounded-md border border-default bg-elevated/20 p-3 text-sm"
              >
                <p class="font-medium">{{ row.date }}</p>
                <p class="text-xs text-muted">
                  Transcription completed: {{ row.transcriptionCompleted }} · failed: {{ row.transcriptionFailed }} · Summary completed: {{ row.summaryCompleted }} · failed: {{ row.summaryFailed }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
