<script setup lang="ts">
import type {
  CampaignRequestCreateInput,
  CampaignRequestDecisionInput,
  CampaignRequestListQueryInput,
  CampaignRequestUpdateInput,
} from '#shared/schemas/campaign-requests'
import type { CampaignAccess } from '#shared/types/campaign-workflow'
import type {
  CampaignRequestListItem,
  CampaignRequestStatus,
  CampaignRequestType,
  CampaignRequestVisibility,
} from '#shared/types/campaign-requests'

definePageMeta({ layout: 'default' })

type RequestTab = 'public' | 'mine' | 'pending' | 'decided' | 'moderation'

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess | undefined>>(
  'campaignAccess',
  computed(() => undefined),
)

const requestApi = useCampaignRequests()
const toast = useToast()

const selectedTab = ref<RequestTab>('public')
const listError = ref('')
const actionError = ref('')

const tabItems = [
  { label: 'Public', value: 'public' },
  { label: 'Mine', value: 'mine' },
  { label: 'Pending', value: 'pending' },
  { label: 'Decided', value: 'decided' },
  { label: 'Moderation Queue', value: 'moderation' },
]

const canSeeModerationTab = computed(() => Boolean(campaignAccess.value?.hasDmAccess))
const visibleTabItems = computed(() =>
  tabItems.filter((tab) => tab.value !== 'moderation' || canSeeModerationTab.value),
)

watch(
  canSeeModerationTab,
  (canModerate) => {
    if (!canModerate && selectedTab.value === 'moderation') {
      selectedTab.value = 'public'
    }
  },
  { immediate: true },
)

const listQuery = computed<CampaignRequestListQueryInput>(() => {
  if (selectedTab.value === 'public') return { visibility: 'PUBLIC', page: 1, pageSize: 50 }
  if (selectedTab.value === 'mine') return { mine: true, page: 1, pageSize: 50 }
  if (selectedTab.value === 'pending') return { status: 'PENDING', page: 1, pageSize: 50 }
  if (selectedTab.value === 'moderation') return { moderationQueue: true, page: 1, pageSize: 50 }
  return { page: 1, pageSize: 100 }
})

const {
  data: listResponse,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `campaign-requests-${campaignId.value}-${selectedTab.value}`,
  async () => {
    listError.value = ''
    try {
      return await requestApi.listRequests(campaignId.value, listQuery.value)
    } catch (requestError) {
      listError.value = (requestError as Error).message || 'Unable to load requests.'
      throw requestError
    }
  },
  { watch: [selectedTab] },
)

const requests = computed(() => {
  const items = listResponse.value?.items || []
  if (selectedTab.value === 'decided') {
    return items.filter((item) => item.status !== 'PENDING')
  }
  return items
})

const isEmpty = computed(() => !requests.value.length)
const hasLoadedAtLeastOnce = computed(() => Array.isArray(listResponse.value?.items))
const showLoadingState = computed(() => pending.value && !hasLoadedAtLeastOnce.value)

const statusLabelMap: Record<CampaignRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  CANCELED: 'Canceled',
}

const statusColor = (status: CampaignRequestStatus) => {
  if (status === 'APPROVED') return 'success'
  if (status === 'DENIED') return 'error'
  if (status === 'CANCELED') return 'neutral'
  return 'warning'
}

const visibilityColor = (visibility: CampaignRequestVisibility) =>
  visibility === 'PUBLIC' ? 'primary' : 'neutral'

const typeLabelMap: Record<CampaignRequestType, string> = {
  ITEM: 'Item',
  PLOT_POINT: 'Plot point',
}

const requestTypeOptions = [
  { label: 'Item', value: 'ITEM' },
  { label: 'Plot point', value: 'PLOT_POINT' },
]

const requestVisibilityOptions = [
  { label: 'DM Only', value: 'PRIVATE' },
  { label: 'Public', value: 'PUBLIC' },
]

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isSaving = ref(false)
const editTargetId = ref('')

const form = reactive<CampaignRequestCreateInput>({
  type: 'ITEM',
  visibility: 'PRIVATE',
  title: '',
  description: '',
})

const resetForm = () => {
  form.type = 'ITEM'
  form.visibility = 'PRIVATE'
  form.title = ''
  form.description = ''
}

const openCreate = () => {
  actionError.value = ''
  editTargetId.value = ''
  resetForm()
  isCreateOpen.value = true
}

const openEdit = (request: CampaignRequestListItem) => {
  actionError.value = ''
  editTargetId.value = request.id
  form.type = request.type
  form.visibility = request.visibility
  form.title = request.title
  form.description = request.description
  isEditOpen.value = true
}

const saveCreate = async () => {
  isSaving.value = true
  actionError.value = ''
  try {
    await requestApi.createRequest(campaignId.value, { ...form })
    isCreateOpen.value = false
    resetForm()
    toast.add({
      title: 'Request created',
      description: 'Your request was added successfully.',
      color: 'success',
      icon: 'i-lucide-check',
    })
    await refresh()
  } catch (requestError) {
    actionError.value = (requestError as Error).message || 'Unable to create request.'
    toast.add({
      title: 'Unable to create request',
      description: actionError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSaving.value = false
  }
}

const saveEdit = async () => {
  if (!editTargetId.value) return
  isSaving.value = true
  actionError.value = ''

  const payload: CampaignRequestUpdateInput = {
    type: form.type,
    visibility: form.visibility,
    title: form.title,
    description: form.description,
  }

  try {
    await requestApi.updateRequest(campaignId.value, editTargetId.value, payload)
    isEditOpen.value = false
    toast.add({
      title: 'Request updated',
      description: 'Your pending request was updated.',
      color: 'success',
      icon: 'i-lucide-check',
    })
    await refresh()
  } catch (requestError) {
    actionError.value = (requestError as Error).message || 'Unable to update request.'
    toast.add({
      title: 'Unable to update request',
      description: actionError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSaving.value = false
  }
}

const actionLoadingByRequestId = reactive<Record<string, boolean>>({})
const moderationNotesByRequestId = reactive<Record<string, string>>({})

const withRequestAction = async (requestId: string, action: () => Promise<void>) => {
  actionLoadingByRequestId[requestId] = true
  try {
    await action()
    await refresh()
  } catch (requestError) {
    const errorMessage = (requestError as Error).message || 'Request action failed.'
    toast.add({
      title: 'Request action failed',
      description: errorMessage,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    actionLoadingByRequestId[requestId] = false
  }
}

const toggleVote = async (request: CampaignRequestListItem) => {
  if (!request.canVote) return
  await withRequestAction(request.id, async () => {
    if (request.viewerHasVoted) {
      await requestApi.removeMyVote(campaignId.value, request.id)
      toast.add({
        title: 'Vote removed',
        description: 'Your vote was removed from this request.',
        color: 'success',
        icon: 'i-lucide-check',
      })
      return
    }
    await requestApi.addVote(campaignId.value, request.id)
    toast.add({
      title: 'Vote added',
      description: 'Your vote was recorded.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })
}

const cancelRequest = async (requestId: string) => {
  await withRequestAction(requestId, async () => {
    await requestApi.cancelRequest(campaignId.value, requestId)
    toast.add({
      title: 'Request canceled',
      description: 'The request is now canceled.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })
}

const decideRequest = async (requestId: string, decision: CampaignRequestDecisionInput['decision']) => {
  await withRequestAction(requestId, async () => {
    const payload: CampaignRequestDecisionInput = {
      decision,
      decisionNote: moderationNotesByRequestId[requestId] || undefined,
    }
    await requestApi.decideRequest(campaignId.value, requestId, payload)
    toast.add({
      title: decision === 'APPROVED' ? 'Request approved' : 'Request denied',
      description: decision === 'APPROVED'
        ? 'The request has been approved.'
        : 'The request has been denied.',
      color: 'success',
      icon: 'i-lucide-check',
    })
    moderationNotesByRequestId[requestId] = ''
  })
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Requests</p>
        <h1 class="mt-2 text-2xl font-semibold">DM request board</h1>
      </div>
      <UButton size="lg" icon="i-lucide-plus" @click="openCreate">
        New request
      </UButton>
    </div>

    <UCard>
      <UTabs v-model="selectedTab" :items="visibleTabItems" :content="false" />
    </UCard>

    <SharedResourceState
      :pending="showLoadingState"
      :error="error || listError"
      :empty="isEmpty"
      error-message="Unable to load request board."
      empty-message="No requests in this view."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard v-for="i in 4" :key="i" class="h-40 animate-pulse" />
        </div>
      </template>
      <template #emptyActions>
        <UButton variant="outline" @click="openCreate">Create request</UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <SharedListItemCard v-for="request in requests" :key="request.id">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Request</p>
                <h3 class="text-base font-semibold">{{ request.title }}</h3>
                <p class="text-xs text-muted">By {{ request.createdByName }}</p>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <UBadge :color="statusColor(request.status)" variant="soft" size="sm">
                  {{ statusLabelMap[request.status] }}
                </UBadge>
                <UBadge :color="visibilityColor(request.visibility)" variant="soft" size="sm">
                  {{ request.visibility === 'PUBLIC' ? 'Public' : 'DM Only' }}
                </UBadge>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ typeLabelMap[request.type] }}
                </UBadge>
              </div>
            </div>
          </template>

          <p class="text-sm text-default">{{ request.description }}</p>

          <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span v-if="request.visibility === 'PUBLIC'">Votes: {{ request.voteCount }}</span>
            <span>Updated: {{ new Date(request.updatedAt).toLocaleString() }}</span>
          </div>

          <div v-if="request.decisionNote" class="mt-3 rounded-md border border-default p-2 text-xs text-muted">
            Decision note: {{ request.decisionNote }}
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              v-if="request.visibility === 'PUBLIC'"
              size="xs"
              variant="outline"
              :disabled="!request.canVote || actionLoadingByRequestId[request.id]"
              :loading="actionLoadingByRequestId[request.id]"
              @click="toggleVote(request)"
            >
              {{ request.viewerHasVoted ? 'Remove vote' : 'Vote' }}
            </UButton>

            <UButton
              v-if="request.canEdit"
              size="xs"
              variant="outline"
              :disabled="actionLoadingByRequestId[request.id]"
              @click="openEdit(request)"
            >
              Edit
            </UButton>

            <UButton
              v-if="request.canCancel"
              size="xs"
              color="warning"
              variant="soft"
              :loading="actionLoadingByRequestId[request.id]"
              @click="cancelRequest(request.id)"
            >
              Cancel
            </UButton>
          </div>

          <div v-if="request.canModerate" class="mt-4 space-y-2">
            <UFormField :label="`Decision note (${request.title})`" :name="`decision-note-${request.id}`">
              <UTextarea
                v-model="moderationNotesByRequestId[request.id]"
                :rows="2"
                placeholder="Optional note shown with decision..."
              />
            </UFormField>
            <div class="flex gap-2">
              <UButton
                size="xs"
                color="success"
                :loading="actionLoadingByRequestId[request.id]"
                @click="decideRequest(request.id, 'APPROVED')"
              >
                Approve
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="soft"
                :loading="actionLoadingByRequestId[request.id]"
                @click="decideRequest(request.id, 'DENIED')"
              >
                Deny
              </UButton>
            </div>
          </div>
        </SharedListItemCard>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isCreateOpen"
      title="Create request"
      description="Use public for player voting, or DM Only for creator + DM visibility."
      :saving="isSaving"
      :error="actionError"
      submit-label="Create"
      @submit="saveCreate"
    >
      <UFormField label="Type" name="type">
        <USelect v-model="form.type" :items="requestTypeOptions" />
      </UFormField>
      <UFormField label="Visibility" name="visibility">
        <USelect v-model="form.visibility" :items="requestVisibilityOptions" />
      </UFormField>
      <UFormField label="Title" name="title">
        <UInput v-model="form.title" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="form.description" :rows="4" />
      </UFormField>
    </SharedEntityFormModal>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      title="Edit request"
      description="You can edit only while the request is pending."
      :saving="isSaving"
      :error="actionError"
      submit-label="Save"
      @submit="saveEdit"
    >
      <UFormField label="Type" name="edit-type">
        <USelect v-model="form.type" :items="requestTypeOptions" />
      </UFormField>
      <UFormField label="Visibility" name="edit-visibility">
        <USelect v-model="form.visibility" :items="requestVisibilityOptions" />
      </UFormField>
      <UFormField label="Title" name="edit-title">
        <UInput v-model="form.title" />
      </UFormField>
      <UFormField label="Description" name="edit-description">
        <UTextarea v-model="form.description" :rows="4" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>
