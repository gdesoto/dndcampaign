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

const { data: recaps, refresh: refreshRecaps } = await useAsyncData(
  () => `campaign-recaps-${campaignId.value}`,
  () => request<RecapItem[]>(`/api/campaigns/${campaignId.value}/recaps`)
)

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

      <div class="grid gap-4 md:grid-cols-2">
        <UCard >
          <template #header>
            <h3 class="text-sm font-semibold text-highlighted">Campaign workbench</h3>
          </template>
          <div class="flex flex-wrap gap-3">
            <UButton size="md" variant="solid" :to="`/campaigns/${campaignId}/sessions`">Sessions</UButton>
            <UButton size="md" variant="solid" :to="`/campaigns/${campaignId}/glossary`">Glossary</UButton>
            <UButton size="md" variant="outline" :to="`/campaigns/${campaignId}/quests`">Quests</UButton>
            <UButton size="md" variant="outline" :to="`/campaigns/${campaignId}/milestones`">Milestones</UButton>
          </div>
        </UCard>
        <UCard >
          <template #header>
            <h3 class="text-sm font-semibold text-highlighted">Next steps</h3>
          </template>
          <p class="text-sm text-default">
            Create a new session, log quest progress, and keep your glossary fresh.
          </p>
        </UCard>
      </div>

      <UCard >
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
          <div class="flex justify-end">
            <UButton :loading="isSaving" @click="saveStatus">Save status</UButton>
          </div>
        </template>
      </UCard>

      <UCard >
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
            <div class="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Now playing</p>
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
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            No recaps yet. Upload a recap on a session to build the playlist.
          </p>
          <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
          <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">Edit campaign</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-default">Name</label>
              <UInput v-model="editForm.name" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">System</label>
              <UInput v-model="editForm.system" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Description</label>
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
