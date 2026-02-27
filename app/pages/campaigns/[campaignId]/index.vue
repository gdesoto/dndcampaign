<script setup lang="ts">
import type {
  CampaignActivityLogItem,
  CampaignMilestoneSummary,
  CampaignOverviewDetail,
  CampaignQuestSummary,
  CampaignSessionSummary,
} from '#shared/types/campaign-overview'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const { data: campaign, pending, refresh, error } = await useAsyncData(
  () => `campaign-${campaignId.value}`,
  () => request<CampaignOverviewDetail>(`/api/campaigns/${campaignId.value}`)
)

const campaignInvalidation = useCampaignWorkspaceInvalidation({
  refreshCampaign: refresh,
})

const { data: sessions } = await useAsyncData(
  () => `campaign-sessions-${campaignId.value}`,
  () => request<CampaignSessionSummary[]>(`/api/campaigns/${campaignId.value}/sessions`)
)

const { data: quests } = await useAsyncData(
  () => `campaign-quests-${campaignId.value}`,
  () => request<CampaignQuestSummary[]>(`/api/campaigns/${campaignId.value}/quests`)
)

const { data: milestones } = await useAsyncData(
  () => `campaign-milestones-${campaignId.value}`,
  () => request<CampaignMilestoneSummary[]>(`/api/campaigns/${campaignId.value}/milestones`)
)
const { data: activityLogs } = await useAsyncData(
  () => `campaign-activity-${campaignId.value}`,
  () => request<CampaignActivityLogItem[]>(`/api/campaigns/${campaignId.value}/activity`),
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
} = useCampaignRecaps(campaignId, campaignInvalidation.afterRecapMutation)

const {
  latestSession,
  activeQuestCount,
  openMilestoneCount,
  recentSessions,
  recentQuests,
  recentMilestones,
  questStatusColor,
} = useCampaignOverviewMetrics(sessions, quests, milestones)
const { activityItems } = useCampaignActivityItems(campaign, activityLogs, recaps, sessions, quests, milestones)
const overviewDescription = computed(() => {
  const details = [
    campaign.value?.system || 'System not set',
    campaign.value?.dungeonMasterName ? `DM: ${campaign.value.dungeonMasterName}` : '',
  ].filter(Boolean)

  return details.join(' • ')
})

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
  if (!canWriteContent.value) return
  saveError.value = ''
  isSaving.value = true
  const previousStatus = campaign.value?.currentStatus || ''
  const previousUpdatedAt = campaign.value?.updatedAt
  if (campaign.value) {
    campaign.value.currentStatus = statusDraft.value || ''
    campaign.value.updatedAt = new Date().toISOString()
  }
  try {
    await request(`/api/campaigns/${campaignId.value}`, {
      method: 'PATCH',
      body: { currentStatus: statusDraft.value || undefined },
    })
    await campaignInvalidation.afterCampaignMutation()
  } catch (error) {
    if (campaign.value) {
      campaign.value.currentStatus = previousStatus
      if (previousUpdatedAt) campaign.value.updatedAt = previousUpdatedAt
    }
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to update status.'
  } finally {
    isSaving.value = false
  }
}

const openEdit = () => {
  if (!canWriteContent.value) return
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
  if (!canWriteContent.value) return
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
    await campaignInvalidation.afterCampaignMutation()
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
  <CampaignListTemplate
    headline="Campaign"
    title="Overview"
    :description="overviewDescription"
  >
    <template #notice>
      <UAlert
        v-if="!canWriteContent"
        color="warning"
        variant="subtle"
        title="Read-only access"
        description="Your role can view this campaign overview but cannot edit campaign details."
      />
    </template>

    <div v-if="pending" class="space-y-4">
      <UCard class="h-28 animate-pulse" />
      <UCard class="h-40 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this campaign.</p>
      <UButton class="mt-4" variant="outline" @click="campaignInvalidation.refreshWorkspace">Try again</UButton>
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
        :readonly="!canWriteContent"
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
        :empty-action-to="`/campaigns/${campaignId}/sessions`"
        empty-action-label="Upload a recap"
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
      @update:form="Object.assign(editForm, $event)"
      @save="saveCampaign"
    />
  </CampaignListTemplate>
</template>
