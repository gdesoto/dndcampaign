<script setup lang="ts">
import type { CampaignActivityLogItem, CampaignMilestoneSummary, CampaignOverviewDetail, CampaignQuestSummary, CampaignSessionSummary } from '#shared/types/campaign-overview'
import { formatSessionDate } from '~/utils/session-date'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

const { campaignId, request, canWriteContent } = useCampaignPageContext()
const { data: campaign, pending, refresh, error } = await useOverviewResource<CampaignOverviewDetail>(campaignId, 'campaign', () => `/api/campaigns/${campaignId.value}`)
const { data: sessions, pending: sessionsPending, error: sessionsError, refresh: refreshSessions } = await useOverviewResource<CampaignSessionSummary[]>(campaignId, 'sessions', () => `/api/campaigns/${campaignId.value}/sessions`)
const { data: quests, pending: questsPending, error: questsError, refresh: refreshQuests } = await useOverviewResource<CampaignQuestSummary[]>(campaignId, 'quests', () => `/api/campaigns/${campaignId.value}/quests`)
const { data: milestones, pending: milestonesPending, error: milestonesError, refresh: refreshMilestones } = await useOverviewResource<CampaignMilestoneSummary[]>(campaignId, 'milestones', () => `/api/campaigns/${campaignId.value}/milestones`)
const { data: activityLogs, pending: activityPending, error: activityError, refresh: refreshActivity } = await useOverviewResource<CampaignActivityLogItem[]>(campaignId, 'activity', () => `/api/campaigns/${campaignId.value}/activity`)
const {
  recaps, recapsPending, recapsError, refreshRecaps, recapsSortedBySessionNumber,
  selectedRecapId, recapPlaybackUrl, recapLoading, recapError, recapDeleting,
  recapDeleteError, playRecap, deleteRecap, openPlayer,
} = useCampaignRecaps(campaignId, refreshActivity)
const { latestSession, activeQuestCount, openMilestoneCount, recentSessions, recentQuests, recentMilestones } = useCampaignOverviewMetrics(sessions, quests, milestones)
const { activityItems } = useCampaignActivityItems(campaign, activityLogs, recaps, sessions, quests, milestones)

const statusDraft = ref('')
const isSaving = ref(false)
const saveError = ref('')
const statusState = useEditorDraft(() => ({ currentStatus: statusDraft.value }), value => { statusDraft.value = value.currentStatus })
watch(campaign, value => {
  if (value) statusState.sync({ currentStatus: value.currentStatus || '' }, value.id)
}, { immediate: true })
const isEditOpen = ref(false)
const editForm = reactive({ name: '', system: '', dungeonMasterName: '', description: '' })
const editError = ref('')
const isUpdating = ref(false)
const mutationBusy = computed(() => isSaving.value || isUpdating.value || recapDeleting.value)
const toast = useToast()

const saveStatus = async () => {
  if (!canWriteContent.value || mutationBusy.value || !statusState.dirty.value) return
  const submitted = statusState.snapshot()
  saveError.value = ''
  isSaving.value = true
  try {
    await request(`/api/campaigns/${campaignId.value}`, { method: 'PATCH', body: submitted })
    statusState.accept(submitted)
    await Promise.all([refresh(), refreshActivity()])
    toast.add({ title: 'Story status saved', color: 'success' })
  } catch (cause) {
    saveError.value = (cause as Error).message || 'Unable to update status.'
  } finally { isSaving.value = false }
}
const openEdit = () => {
  if (!canWriteContent.value || !campaign.value || mutationBusy.value) return
  editError.value = ''
  const value = campaign.value
  Object.assign(editForm, { name: value.name, system: value.system, dungeonMasterName: value.dungeonMasterName || '', description: value.description || '' })
  isEditOpen.value = true
}
const saveCampaign = async () => {
  if (!canWriteContent.value || mutationBusy.value) return
  const submitted = { ...editForm }
  editError.value = ''
  isUpdating.value = true
  try {
    await request(`/api/campaigns/${campaignId.value}`, { method: 'PATCH', body: submitted })
    isEditOpen.value = false
    await Promise.all([refresh(), refreshActivity(), refreshNuxtData(`dashboard-campaign-shell-${campaignId.value}`)])
    toast.add({ title: 'Campaign saved', color: 'success' })
  } catch (cause) {
    editError.value = (cause as Error).message || 'Unable to update campaign.'
  } finally { isUpdating.value = false }
}
</script>

<template>
  <CampaignListTemplate title="Overview">
    <template #actions>
      <UButton v-if="canWriteContent" variant="outline" icon="i-lucide-pencil" :disabled="mutationBusy" @click="openEdit">Edit campaign</UButton>
    </template>
    <template #notice>
      <SharedReadOnlyAlert v-if="!canWriteContent" description="Your role can view this campaign overview but cannot edit campaign details." />
    </template>
    <SharedResourceState :pending="pending" :error="error" :has-data="Boolean(campaign)" :empty="!campaign" empty-message="Campaign not found." error-message="Unable to load this campaign." @retry="refresh">
      <div v-if="campaign" class="min-w-0 space-y-4">
        <UCard v-if="campaign.description">
          <div class="flex items-start gap-4">
            <UIcon name="i-lucide-scroll-text" class="mt-1 size-7 shrink-0 text-primary" aria-hidden="true" />
            <p class="reading-copy min-w-0 whitespace-pre-line text-default">{{ campaign.description }}</p>
          </div>
        </UCard>
        <CampaignKpiGrid
          :campaign-id="campaignId" :latest-session-id="latestSession?.id"
          :last-session-number="sessions ? latestSession?.sessionNumber ?? '—' : '—'"
          :last-session-date-label="sessions ? (latestSession ? formatSessionDate(latestSession.playedAt) : 'No sessions yet') : 'Sessions unavailable'"
          :active-quest-count="quests ? activeQuestCount : '—'"
          :open-milestone-count="milestones ? openMilestoneCount : '—'"
          :recap-count="recaps ? recaps.length : '—'"
        />
        <CampaignOverviewCollections
          :campaign-id="campaignId" :sessions="recentSessions" :quests="recentQuests" :milestones="recentMilestones"
          :sessions-state="{ pending: sessionsPending, error: sessionsError, hasData: Boolean(sessions) }"
          :quests-state="{ pending: questsPending, error: questsError, hasData: Boolean(quests) }"
          :milestones-state="{ pending: milestonesPending, error: milestonesError, hasData: Boolean(milestones) }"
          @retry-sessions="refreshSessions" @retry-quests="refreshQuests" @retry-milestones="refreshMilestones"
        />
        <SharedResourceState :pending="recapsPending" :error="recapsError" :has-data="Boolean(recaps)" error-message="Unable to load recaps." @retry="refreshRecaps">
          <CampaignRecapPlaylist
            :campaign-id="campaignId" :recaps="recapsSortedBySessionNumber" :selected-recap-id="selectedRecapId"
            :playback-url="recapPlaybackUrl" :loading="recapLoading" :deleting="mutationBusy" :error="recapError" :delete-error="recapDeleteError"
            :can-delete="canWriteContent" :delete-action="deleteRecap"
            :empty-action-to="`/campaigns/${campaignId}/sessions`" :empty-action-label="canWriteContent ? 'Upload a recap' : 'View sessions'"
            @play="playRecap" @select="selectedRecapId = $event" @open-player="openPlayer"
          />
        </SharedResourceState>
      </div>
    </SharedResourceState>
    <template #aside>
      <template v-if="campaign">
        <CampaignStatusEditor v-model:value="statusDraft" :readonly="!canWriteContent" :saving="isSaving" :busy="isUpdating || recapDeleting" :dirty="statusState.dirty.value" :error="saveError" :updated-at-label="new Date(campaign.updatedAt).toLocaleString()" @save="saveStatus" @discard="statusState.discard()" />
        <SharedResourceState :pending="activityPending" :error="activityError" :has-data="Boolean(activityLogs)" error-message="Unable to load recent activity." @retry="refreshActivity">
          <CampaignRecentActivity :campaign-id="campaignId" :items="activityItems" />
        </SharedResourceState>
      </template>
    </template>
    <CampaignEditModal v-model:open="isEditOpen" :form="editForm" :saving="isUpdating" :error="editError" @update:form="Object.assign(editForm, $event)" @save="saveCampaign" />
  </CampaignListTemplate>
</template>
