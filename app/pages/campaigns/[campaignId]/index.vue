<script setup lang="ts">
type Campaign = {
  id: string
  name: string
  system: string
  dungeonMasterName?: string | null
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

const formatDate = (value?: string | null) => {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleDateString()
}

const {
  recaps,
  selectedRecapId,
  recapPlaybackUrl,
  recapLoading,
  recapError,
  recapDeleting,
  recapDeleteError,
  playRecap,
  deleteRecap,
  openPlayer,
} = useCampaignRecaps(campaignId)

const {
  latestSession,
  activeQuestCount,
  openMilestoneCount,
  recentSessions,
  recentQuests,
  recentMilestones,
  questStatusColor,
} = useCampaignOverviewMetrics(sessions, quests, milestones)
const { activityItems } = useCampaignActivityItems(campaign, recaps, sessions, quests, milestones)

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
  dungeonMasterName: '',
  description: '',
})
const editError = ref('')
const isUpdating = ref(false)

watch(
  () => campaign.value,
  (value) => {
    editForm.name = value?.name || ''
    editForm.system = value?.system || ''
    editForm.dungeonMasterName = value?.dungeonMasterName || ''
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
    editForm.dungeonMasterName = campaign.value.dungeonMasterName || ''
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
        dungeonMasterName: editForm.dungeonMasterName || undefined,
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
  <div class="space-y-8 theme-reveal">
    <div v-if="pending" class="space-y-4">
      <UCard class="h-28 animate-pulse" />
      <UCard class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this campaign.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <div v-else-if="campaign" class="space-y-6">
      <CampaignHeaderCard
        :system="campaign.system"
        :dungeon-master-name="campaign.dungeonMasterName"
        :description="campaign.description"
        @edit="openEdit"
      />

      <CampaignKpiGrid
        :last-session-number="latestSession?.sessionNumber ?? '-'"
        :last-session-date-label="latestSession ? formatDate(latestSession.playedAt || latestSession.createdAt) : 'No sessions yet.'"
        :active-quest-count="activeQuestCount"
        :open-milestone-count="openMilestoneCount"
        :recap-count="recaps?.length || 0"
      />

      <CampaignStatusEditor
        v-model:value="statusDraft"
        :saving="isSaving"
        :error="saveError"
        :updated-at-label="new Date(campaign.updatedAt).toLocaleString()"
        @save="saveStatus"
      />

      <CampaignOverviewCollections
        :campaign-id="campaignId"
        :sessions="recentSessions"
        :quests="recentQuests"
        :milestones="recentMilestones"
        :quest-status-color="questStatusColor"
      />

      <CampaignRecapPlaylist
        :campaign-id="campaignId"
        :recaps="recaps"
        :selected-recap-id="selectedRecapId"
        :playback-url="recapPlaybackUrl"
        :loading="recapLoading"
        :deleting="recapDeleting"
        :error="recapError"
        :delete-error="recapDeleteError"
        @play="playRecap"
        @delete="deleteRecap"
        @open-player="openPlayer"
      />

      <CampaignRecentActivity
        :campaign-id="campaignId"
        :items="activityItems"
      />
    </div>

    <CampaignEditModal
      v-model:open="isEditOpen"
      :form="editForm"
      :saving="isUpdating"
      :error="editError"
      @save="saveCampaign"
    />
  </div>
</template>
