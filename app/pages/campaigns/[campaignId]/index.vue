<script setup lang="ts">
definePageMeta({ layout: 'app' })

type Campaign = {
  id: string
  name: string
  system: string
  description?: string | null
  currentStatus?: string | null
  createdAt: string
  updatedAt: string
}

type SessionSummary = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  createdAt: string
}

type QuestSummary = {
  id: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  updatedAt?: string | null
  createdAt?: string | null
}

type MilestoneSummary = {
  id: string
  title: string
  isComplete: boolean
  completedAt?: string | null
  createdAt?: string | null
}

type RecapItem = {
  id: string
  filename: string
  createdAt: string
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

const { data: campaign, pending, refresh, error } = await useAsyncData(
  () => `campaign-${campaignId.value}`,
  () => request<Campaign>(`/api/campaigns/${campaignId.value}`)
)

const { data: sessions } = await useAsyncData(
  () => `campaign-sessions-${campaignId.value}`,
  () => request<SessionSummary[]>(`/api/campaigns/${campaignId.value}/sessions`)
)

const { data: quests } = await useAsyncData(
  () => `campaign-quests-${campaignId.value}`,
  () => request<QuestSummary[]>(`/api/campaigns/${campaignId.value}/quests`)
)

const { data: milestones } = await useAsyncData(
  () => `campaign-milestones-${campaignId.value}`,
  () => request<MilestoneSummary[]>(`/api/campaigns/${campaignId.value}/milestones`)
)

const { data: recaps, refresh: refreshRecaps } = await useAsyncData(
  () => `campaign-recaps-${campaignId.value}`,
  () => request<RecapItem[]>(`/api/campaigns/${campaignId.value}/recaps`)
)

const activeTab = ref('overview')
const tabItems = [
  { label: 'Overview', value: 'overview' },
  { label: 'Sessions', value: 'sessions' },
  { label: 'Quests', value: 'quests' },
  { label: 'Milestones', value: 'milestones' },
  { label: 'Recap playlist', value: 'recaps' },
  { label: 'Glossary', value: 'glossary' },
]

const formatDate = (value?: string | null) => {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleDateString()
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleString()
}

const sortByDate = <T extends { createdAt?: string | null }>(
  items: T[],
  getDate: (item: T) => string | null | undefined
) =>
  [...items].sort(
    (a, b) =>
      new Date(getDate(b) || b.createdAt || 0).getTime()
      - new Date(getDate(a) || a.createdAt || 0).getTime()
  )

const latestSession = computed(() => {
  const list = sessions.value || []
  return list.reduce<SessionSummary | null>((latest, current) => {
    const currentDate = new Date(current.playedAt || current.createdAt).getTime()
    const latestDate = latest ? new Date(latest.playedAt || latest.createdAt).getTime() : 0
    return currentDate > latestDate ? current : latest
  }, null)
})

const activeQuestCount = computed(
  () => (quests.value || []).filter((quest) => quest.status === 'ACTIVE').length
)

const openMilestoneCount = computed(
  () => (milestones.value || []).filter((milestone) => !milestone.isComplete).length
)

const recentSessions = computed(() =>
  sortByDate(sessions.value || [], (session) => session.playedAt).slice(0, 5)
)

const recentQuests = computed(() =>
  sortByDate(quests.value || [], (quest) => quest.updatedAt || quest.createdAt).slice(0, 5)
)

const recentMilestones = computed(() =>
  sortByDate(milestones.value || [], (milestone) => milestone.completedAt || milestone.createdAt).slice(0, 5)
)

const activityItems = computed(() => {
  const items: Array<{ id: string; date: string; title: string; description: string }> = []
  if (campaign.value?.updatedAt) {
    items.push({
      id: `campaign-${campaign.value.id}`,
      date: campaign.value.updatedAt,
      title: 'Campaign updated',
      description: `Updated ${formatDateTime(campaign.value.updatedAt)}.`,
    })
  }
  for (const recap of recaps.value || []) {
    items.push({
      id: `recap-${recap.id}`,
      date: recap.createdAt,
      title: 'Recap uploaded',
      description: `${recap.session.title} · ${formatDateTime(recap.createdAt)}`,
    })
  }
  for (const session of sessions.value || []) {
    const date = session.playedAt || session.createdAt
    items.push({
      id: `session-${session.id}`,
      date,
      title: `Session ${session.sessionNumber ?? '—'}`,
      description: `${session.title} · ${formatDateTime(date)}`,
    })
  }
  for (const quest of quests.value || []) {
    const date = quest.updatedAt || quest.createdAt
    if (!date) continue
    items.push({
      id: `quest-${quest.id}`,
      date,
      title: 'Quest updated',
      description: `${quest.title} · ${formatDateTime(date)}`,
    })
  }
  for (const milestone of milestones.value || []) {
    const date = milestone.completedAt || milestone.createdAt
    if (!date) continue
    items.push({
      id: `milestone-${milestone.id}`,
      date,
      title: milestone.isComplete ? 'Milestone completed' : 'Milestone updated',
      description: `${milestone.title} · ${formatDateTime(date)}`,
    })
  }
  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)
})

const questStatusColor = (status: QuestSummary['status']) => {
  switch (status) {
    case 'COMPLETED':
      return 'success'
    case 'FAILED':
      return 'error'
    case 'ON_HOLD':
      return 'warning'
    default:
      return 'secondary'
  }
}

const selectedRecapId = ref('')
const recapPlaybackUrl = ref('')
const recapLoading = ref(false)
const recapError = ref('')
const recapDeleting = ref(false)
const recapDeleteError = ref('')

watch(
  () => recaps.value,
  (value) => {
    if (value?.length && !selectedRecapId.value) {
      selectedRecapId.value = value[0].id
    }
  },
  { immediate: true }
)

const playRecap = async (recapId: string) => {
  recapError.value = ''
  recapLoading.value = true
  try {
    const payload = await request<{ url: string }>(`/api/recaps/${recapId}/playback-url`)
    recapPlaybackUrl.value = payload.url
    selectedRecapId.value = recapId
  } catch (error) {
    recapError.value =
      (error as Error & { message?: string }).message || 'Unable to load recap.'
  } finally {
    recapLoading.value = false
  }
}

const deleteRecap = async (recapId: string) => {
  recapDeleteError.value = ''
  recapDeleting.value = true
  try {
    await request(`/api/recaps/${recapId}`, { method: 'DELETE' })
    if (selectedRecapId.value === recapId) {
      recapPlaybackUrl.value = ''
      selectedRecapId.value = ''
    }
    await refreshRecaps()
  } catch (error) {
    recapDeleteError.value =
      (error as Error & { message?: string }).message || 'Unable to delete recap.'
  } finally {
    recapDeleting.value = false
  }
}

const statusDraft = ref('')
const isSaving = ref(false)
const saveError = ref('')

watch(
  () => campaign.value,
  (value) => {
    statusDraft.value = value?.currentStatus || ''
  },
  { immediate: true }
)

const isEditOpen = ref(false)
const editForm = reactive({
  name: '',
  system: '',
  description: '',
})
const editError = ref('')
const isUpdating = ref(false)

watch(
  () => campaign.value,
  (value) => {
    editForm.name = value?.name || ''
    editForm.system = value?.system || ''
    editForm.description = value?.description || ''
  },
  { immediate: true }
)

const saveStatus = async () => {
  saveError.value = ''
  isSaving.value = true
  try {
    await request(`/api/campaigns/${campaignId.value}`, {
      method: 'PATCH',
      body: { currentStatus: statusDraft.value || undefined },
    })
    await refresh()
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to update status.'
  } finally {
    isSaving.value = false
  }
}

const openEdit = () => {
  editError.value = ''
  if (campaign.value) {
    editForm.name = campaign.value.name
    editForm.system = campaign.value.system
    editForm.description = campaign.value.description || ''
  }
  isEditOpen.value = true
}

const saveCampaign = async () => {
  editError.value = ''
  isUpdating.value = true
  try {
    await request(`/api/campaigns/${campaignId.value}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        system: editForm.system || undefined,
        description: editForm.description || undefined,
      },
    })
    await refresh()
    isEditOpen.value = false
  } catch (error) {
    editError.value =
      (error as Error & { message?: string }).message || 'Unable to update campaign.'
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <UPage>
    <div class="space-y-8">
    <div v-if="pending" class="space-y-4">
      <UCard  class="h-28 animate-pulse" />
      <UCard  class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this campaign.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else-if="campaign" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-dimmed">{{ campaign.system }}</p>
          <h1 class="mt-2 text-3xl font-semibold">{{ campaign.name }}</h1>
          <p class="mt-2 text-sm text-muted">
            {{ campaign.description || 'Add a short overview for the campaign.' }}
          </p>
        </div>
        <UButton size="xl" variant="subtle" @click="openEdit">Edit campaign</UButton>
      </div>

      <div class="grid gap-4 md:grid-cols-4">
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Last session</p>
          <p class="mt-2 text-lg font-semibold">
            {{ latestSession?.sessionNumber ?? '—' }}
          </p>
          <p class="text-xs text-muted">
            {{ latestSession ? formatDate(latestSession.playedAt || latestSession.createdAt) : 'No sessions yet.' }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Active quests</p>
          <p class="mt-2 text-lg font-semibold">{{ activeQuestCount }}</p>
          <p class="text-xs text-muted">
            {{ activeQuestCount ? 'Keep them moving.' : 'Ready for a new thread.' }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Open milestones</p>
          <p class="mt-2 text-lg font-semibold">{{ openMilestoneCount }}</p>
          <p class="text-xs text-muted">
            {{ openMilestoneCount ? 'Progress is steady.' : 'Milestones are clear.' }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recaps</p>
          <p class="mt-2 text-lg font-semibold">{{ recaps?.length || 0 }}</p>
          <p class="text-xs text-muted">
            {{ recaps?.length ? 'Keep the story alive.' : 'Upload the first recap.' }}
          </p>
        </UCard>
      </div>

      <UTabs v-model="activeTab" :items="tabItems" variant="pill" size="sm">
        <template #content="{ item }">
          <div v-if="item.value === 'overview'" class="space-y-6">
            <UCard>
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Current status</h2>
              <p class="text-sm text-muted">Update where the story left off.</p>
            </div>
          </template>
              <div class="space-y-4">
                <UTextarea v-model="statusDraft" :rows="6" placeholder="Where did we last leave the party?" />
                <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
              </div>
              <template #footer>
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="text-xs text-muted">
                    Last updated: {{ formatDateTime(campaign.updatedAt) }}
                  </p>
                  <UButton :loading="isSaving" @click="saveStatus">Save status</UButton>
                </div>
              </template>
            </UCard>

            <div class="grid gap-4 lg:grid-cols-3">
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold">Recent sessions</h3>
                    <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/sessions`">
                      View all
                    </UButton>
                  </div>
                </template>
                <div v-if="recentSessions.length" class="space-y-3 text-sm">
                  <div
                    v-for="session in recentSessions"
                    :key="session.id"
                    class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                  >
                    <div>
                      <p class="font-semibold">{{ session.title }}</p>
                      <p class="text-xs text-muted">
                        Session {{ session.sessionNumber ?? '—' }} · {{ formatDate(session.playedAt || session.createdAt) }}
                      </p>
                    </div>
                    <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/sessions/${session.id}`">
                      Open
                    </UButton>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">No sessions yet.</p>
              </UCard>

              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold">Active quests</h3>
                    <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/quests`">
                      View all
                    </UButton>
                  </div>
                </template>
                <div v-if="recentQuests.length" class="space-y-3 text-sm">
                  <div
                    v-for="quest in recentQuests"
                    :key="quest.id"
                    class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                  >
                    <div>
                      <p class="font-semibold">{{ quest.title }}</p>
                      <p class="text-xs text-muted">Status: {{ quest.status }}</p>
                    </div>
                    <UBadge :color="questStatusColor(quest.status)" variant="soft" size="sm">
                      {{ quest.status }}
                    </UBadge>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">No quests yet.</p>
              </UCard>

              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold">Milestones</h3>
                    <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/milestones`">
                      View all
                    </UButton>
                  </div>
                </template>
                <div v-if="recentMilestones.length" class="space-y-3 text-sm">
                  <div
                    v-for="milestone in recentMilestones"
                    :key="milestone.id"
                    class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                  >
                    <div>
                      <p class="font-semibold">{{ milestone.title }}</p>
                      <p class="text-xs text-muted">
                        {{ milestone.isComplete ? 'Completed' : 'In progress' }}
                      </p>
                    </div>
                    <UBadge :color="milestone.isComplete ? 'success' : 'secondary'" variant="soft" size="sm">
                      {{ milestone.isComplete ? 'Done' : 'Open' }}
                    </UBadge>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">No milestones yet.</p>
              </UCard>
            </div>

            <UCard>
              <template #header>
                <div>
                  <h2 class="text-lg font-semibold">Recap playlist</h2>
                  <p class="text-sm text-muted">
                    Listen to session recaps across the campaign.
                  </p>
                </div>
              </template>
              <div class="space-y-4">
                <div v-if="recaps?.length" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div class="space-y-3">
                    <div
                      v-for="recap in recaps"
                      :key="recap.id"
                      class="flex items-start justify-between gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm transition"
                      :class="recap.id === selectedRecapId ? 'bg-primary/10 border-primary/40' : ''"
                    >
                      <div>
                        <p class="font-semibold">{{ recap.session.title }}</p>
                        <p class="text-xs text-muted">
                          Session {{ recap.session.sessionNumber ?? '—' }}
                          · {{ recap.session.playedAt ? new Date(recap.session.playedAt).toLocaleDateString() : 'Unscheduled' }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <UButton
                          size="xs"
                          variant="outline"
                          :loading="recapLoading && recap.id === selectedRecapId"
                          @click="playRecap(recap.id)"
                        >
                          Play
                        </UButton>
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="red"
                          :loading="recapDeleting"
                          @click="deleteRecap(recap.id)"
                        >
                          Delete
                        </UButton>
                      </div>
                    </div>
                  </div>
                  <UCard class="text-xs">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Now playing</p>
                    <p class="mt-2 text-sm font-semibold">
                      {{ recaps.find((item) => item.id === selectedRecapId)?.session.title || 'Pick a recap' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ recaps.find((item) => item.id === selectedRecapId)?.session.sessionNumber ?? '—' }}
                    </p>
                    <div class="mt-3">
                      <audio
                        v-if="recapPlaybackUrl"
                        class="w-full"
                        controls
                        preload="metadata"
                        :src="recapPlaybackUrl"
                      />
                      <p v-else class="text-xs text-muted">
                        Select a recap to start listening.
                      </p>
                    </div>
                  </UCard>
                </div>
                <div v-else class="space-y-3">
                  <p class="text-sm text-muted">
                    No recaps yet. Upload a recap on a session to build the playlist.
                  </p>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
                    Upload a recap
                  </UButton>
                </div>
                <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
                <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h2 class="text-lg font-semibold">Recent activity</h2>
                    <p class="text-sm text-muted">Latest changes across the campaign.</p>
                  </div>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">View sessions</UButton>
                </div>
              </template>
              <div v-if="activityItems.length" class="space-y-4">
                <UTimeline :items="activityItems">
                  <template #date="{ item }">
                    <span class="text-xs text-muted">{{ formatDateTime(item.date) }}</span>
                  </template>
                  <template #title="{ item }">
                    <span class="text-sm font-semibold">{{ item.title }}</span>
                  </template>
                  <template #description="{ item }">
                    <span class="text-xs text-muted">{{ item.description }}</span>
                  </template>
                </UTimeline>
              </div>
              <p v-else class="text-sm text-muted">No recent activity yet.</p>
            </UCard>
          </div>

          <div v-else-if="item.value === 'sessions'" class="space-y-4">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold">Sessions</h2>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">Open log</UButton>
                </div>
              </template>
              <div v-if="sessions?.length" class="space-y-3 text-sm">
                <div
                  v-for="session in sessions"
                  :key="session.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                >
                  <div>
                    <p class="font-semibold">{{ session.title }}</p>
                    <p class="text-xs text-muted">
                      Session {{ session.sessionNumber ?? '—' }} · {{ formatDate(session.playedAt || session.createdAt) }}
                    </p>
                  </div>
                  <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/sessions/${session.id}`">
                    Open
                  </UButton>
                </div>
              </div>
              <p v-else class="text-sm text-muted">No sessions yet.</p>
            </UCard>
          </div>

          <div v-else-if="item.value === 'quests'" class="space-y-4">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold">Quests</h2>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/quests`">Open quests</UButton>
                </div>
              </template>
              <div v-if="quests?.length" class="space-y-3 text-sm">
                <div
                  v-for="quest in quests"
                  :key="quest.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                >
                  <div>
                    <p class="font-semibold">{{ quest.title }}</p>
                    <p class="text-xs text-muted">Status: {{ quest.status }}</p>
                  </div>
                  <UBadge :color="questStatusColor(quest.status)" variant="soft" size="sm">
                    {{ quest.status }}
                  </UBadge>
                </div>
              </div>
              <p v-else class="text-sm text-muted">No quests yet.</p>
            </UCard>
          </div>

          <div v-else-if="item.value === 'milestones'" class="space-y-4">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold">Milestones</h2>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/milestones`">Open milestones</UButton>
                </div>
              </template>
              <div v-if="milestones?.length" class="space-y-3 text-sm">
                <div
                  v-for="milestone in milestones"
                  :key="milestone.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
                >
                  <div>
                    <p class="font-semibold">{{ milestone.title }}</p>
                    <p class="text-xs text-muted">
                      {{ milestone.isComplete ? 'Completed' : 'In progress' }}
                    </p>
                  </div>
                  <UBadge :color="milestone.isComplete ? 'success' : 'secondary'" variant="soft" size="sm">
                    {{ milestone.isComplete ? 'Done' : 'Open' }}
                  </UBadge>
                </div>
              </div>
              <p v-else class="text-sm text-muted">No milestones yet.</p>
            </UCard>
          </div>

          <div v-else-if="item.value === 'recaps'" class="space-y-4">
            <UCard>
              <template #header>
                <div>
                  <h2 class="text-lg font-semibold">Recap playlist</h2>
                  <p class="text-sm text-muted">
                    Listen to session recaps across the campaign.
                  </p>
                </div>
              </template>
              <div class="space-y-4">
                <div v-if="recaps?.length" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div class="space-y-3">
                    <div
                      v-for="recap in recaps"
                      :key="recap.id"
                      class="flex items-start justify-between gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm transition"
                      :class="recap.id === selectedRecapId ? 'bg-primary/10 border-primary/40' : ''"
                    >
                      <div>
                        <p class="font-semibold">{{ recap.session.title }}</p>
                        <p class="text-xs text-muted">
                          Session {{ recap.session.sessionNumber ?? '—' }}
                          · {{ recap.session.playedAt ? new Date(recap.session.playedAt).toLocaleDateString() : 'Unscheduled' }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <UButton
                          size="xs"
                          variant="outline"
                          :loading="recapLoading && recap.id === selectedRecapId"
                          @click="playRecap(recap.id)"
                        >
                          Play
                        </UButton>
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="red"
                          :loading="recapDeleting"
                          @click="deleteRecap(recap.id)"
                        >
                          Delete
                        </UButton>
                      </div>
                    </div>
                  </div>
                  <UCard class="text-xs">
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Now playing</p>
                    <p class="mt-2 text-sm font-semibold">
                      {{ recaps.find((item) => item.id === selectedRecapId)?.session.title || 'Pick a recap' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ recaps.find((item) => item.id === selectedRecapId)?.session.sessionNumber ?? '—' }}
                    </p>
                    <div class="mt-3">
                      <audio
                        v-if="recapPlaybackUrl"
                        class="w-full"
                        controls
                        preload="metadata"
                        :src="recapPlaybackUrl"
                      />
                      <p v-else class="text-xs text-muted">
                        Select a recap to start listening.
                      </p>
                    </div>
                  </UCard>
                </div>
                <div v-else class="space-y-3">
                  <p class="text-sm text-muted">
                    No recaps yet. Upload a recap on a session to build the playlist.
                  </p>
                  <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
                    Upload a recap
                  </UButton>
                </div>
                <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
                <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
              </div>
            </UCard>
          </div>

          <div v-else class="space-y-4">
            <UCard>
              <template #header>
                <div>
                  <h2 class="text-lg font-semibold">Glossary</h2>
                  <p class="text-sm text-muted">Track NPCs, locations, and items.</p>
                </div>
              </template>
              <div class="space-y-3">
                <p class="text-sm text-muted">
                  Keep your world index updated with every session.
                </p>
                <UButton variant="outline" :to="`/campaigns/${campaignId}/glossary`">
                  Open glossary
                </UButton>
              </div>
            </UCard>
          </div>
        </template>
      </UTabs>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">Edit campaign</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Name</label>
              <UInput v-model="editForm.name" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">System</label>
              <UInput v-model="editForm.system" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Description</label>
              <UTextarea v-model="editForm.description" :rows="5" />
            </div>
            <p v-if="editError" class="text-sm text-error">{{ editError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isEditOpen = false">Cancel</UButton>
              <UButton :loading="isUpdating" @click="saveCampaign">Save changes</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
    </div>
  </UPage>
</template>
