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

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

const { data: campaign, pending, refresh, error } = await useAsyncData(
  () => `campaign-${campaignId.value}`,
  () => request<Campaign>(`/api/campaigns/${campaignId.value}`)
)

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
      <UCard class="h-28 animate-pulse bg-white/80 dark:bg-slate-900/40" />
      <UCard class="h-40 animate-pulse bg-white/80 dark:bg-slate-900/40" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-dashed border-red-900/60 p-10 text-center">
      <p class="text-sm text-red-300">Unable to load this campaign.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </div>

    <div v-else-if="campaign" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">{{ campaign.system }}</p>
          <h1 class="mt-2 text-3xl font-semibold">{{ campaign.name }}</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ campaign.description || 'Add a short overview for the campaign.' }}
          </p>
        </div>
        <UButton variant="outline" @click="openEdit">Edit campaign</UButton>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Campaign workbench</h3>
          </template>
          <div class="flex flex-wrap gap-3">
            <UButton size="sm" variant="outline" :to="`/campaigns/${campaignId}/glossary`">Glossary</UButton>
            <UButton size="sm" variant="outline" :to="`/campaigns/${campaignId}/quests`">Quests</UButton>
            <UButton size="sm" variant="outline" :to="`/campaigns/${campaignId}/milestones`">Milestones</UButton>
            <UButton size="sm" variant="outline" :to="`/campaigns/${campaignId}/sessions`">Sessions</UButton>
          </div>
        </UCard>
        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Next steps</h3>
          </template>
          <p class="text-sm text-slate-700 dark:text-slate-300">
            Create a new session, log quest progress, and keep your glossary fresh.
          </p>
        </UCard>
      </div>

      <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Current status</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">Update where the story left off.</p>
          </div>
        </template>
        <div class="space-y-4">
          <UTextarea v-model="statusDraft" :rows="6" placeholder="Where did we last leave the party?" />
          <p v-if="saveError" class="text-sm text-red-300">{{ saveError }}</p>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton :loading="isSaving" @click="saveStatus">Save status</UButton>
          </div>
        </template>
      </UCard>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #content>
        <UCard class="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <template #header>
            <h2 class="text-lg font-semibold">Edit campaign</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Name</label>
              <UInput v-model="editForm.name" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">System</label>
              <UInput v-model="editForm.system" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Description</label>
              <UTextarea v-model="editForm.description" :rows="5" />
            </div>
            <p v-if="editError" class="text-sm text-red-300">{{ editError }}</p>
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
