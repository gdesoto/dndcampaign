<script setup lang="ts">
import { sessionFormSchema } from '~/utils/entity-form-schemas'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
import { formatSessionDate, serializeSessionDateInput } from '~/utils/session-date'
definePageMeta({ layout: 'dashboard' })

type SessionItem = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  notes?: string | null
  createdAt: string
}

const { campaignId, request, canWriteContent } = useCampaignPageContext()

const resourceKey = () => `sessions-${campaignId.value}`
const retained = useRetainedResource<SessionItem[] | null>(resourceKey)
const { data: sessions, pending, refresh, error } = await useAsyncData(
  resourceKey,
  () => retained.load(() => request<SessionItem[]>(`/api/campaigns/${campaignId.value}/sessions`)),
  { default: retained.get }
)
retained.seed(sessions.value)

const search = ref('')
const showNewestFirst = ref(true)
const orderedSessions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  const sessionList = (sessions.value || []).filter(session =>
    `${session.title} ${session.sessionNumber ?? ''} ${session.notes ?? ''}`.toLocaleLowerCase().includes(query)
  )
  return showNewestFirst.value ? [...sessionList].reverse() : sessionList
})
const toggleSessionOrder = () => {
  showNewestFirst.value = !showNewestFirst.value
}

const isCreateOpen = ref(false)
const createForm = reactive({
  title: '',
  sessionNumber: '',
  playedAt: '',
  guestDungeonMasterName: '',
  notes: '',
})
const createError = ref('')
const isCreating = ref(false)

const openCreate = () => {
  if (!canWriteContent.value || isCreating.value) return
  createError.value = ''
  createForm.title = ''
  createForm.sessionNumber = ''
  createForm.playedAt = ''
  createForm.guestDungeonMasterName = ''
  createForm.notes = ''
  isCreateOpen.value = true
}

const createSession = async () => {
  if (!canWriteContent.value || isCreating.value) return
  createError.value = ''
  isCreating.value = true
  try {
    const payload = {
      title: createForm.title,
      sessionNumber: createForm.sessionNumber ? Number(createForm.sessionNumber) : undefined,
      playedAt: serializeSessionDateInput(createForm.playedAt) || undefined,
      guestDungeonMasterName: createForm.guestDungeonMasterName || undefined,
      notes: createForm.notes || undefined,
    }
    const created = await request<SessionItem>(
      `/api/campaigns/${campaignId.value}/sessions`,
      {
        method: 'POST',
        body: payload,
      }
    )
    if (!created) {
      throw new Error('Unable to create session.')
    }
    isCreateOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/sessions/${created.id}`)
  } catch (error) {
    createError.value =
      (error as Error & { message?: string }).message || 'Unable to create session.'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <CampaignListTemplate
      headline="Sessions"
        title="Session log"
        :count="sessions?.length"
      description="Browse and open campaign sessions."
      action-label="New session"
      action-icon="i-lucide-plus"
      :action-disabled="!canWriteContent"
      @action="openCreate"
    >
      <template #filters>
        <UCard variant="soft">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <UFormField label="Search sessions" name="sessionSearch" class="w-full sm:max-w-sm">
              <UInput v-model="search" icon="i-lucide-search" placeholder="Title, number, or notes" class="w-full" />
            </UFormField>
            <UButton color="neutral" variant="outline" icon="i-lucide-arrow-up-down" @click="toggleSessionOrder">
              {{ showNewestFirst ? 'Newest first' : 'Oldest first' }}
            </UButton>
          </div>
        </UCard>
      </template>
      <template #notice>
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can view sessions but cannot create or edit them."
        />
      </template>

      <SharedResourceState
:has-data="Boolean(sessions?.length)"
        :pending="pending"
        :error="error"
        :empty="!orderedSessions.length"
        :no-matches="Boolean(sessions?.length && search.trim())"
        error-message="Unable to load sessions."
        empty-message="No sessions yet."
        @retry="refresh"
        @clear="search = ''"
      >
        <template #loading><USkeleton class="h-32 w-full" /></template>
        <template #emptyActions>
          <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first session</UButton>
        </template>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <ol class="divide-y divide-default">
            <li v-for="session in orderedSessions" :key="session.id">
              <NuxtLink
                :to="`/campaigns/${campaignId}/sessions/${session.id}`"
                class="group flex min-w-0 items-start gap-4 p-4 sm:p-5 hover:bg-accented/50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
              >
                <div class="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary" aria-hidden="true">
                  <span class="type-label">Session</span>
                  <span class="type-section tabular-nums">{{ session.sessionNumber ?? '—' }}</span>
                </div>
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 class="type-record text-highlighted wrap-break-word">{{ session.title }}<span class="sr-only"> · Session {{ session.sessionNumber ?? 'unnumbered' }}</span></h2>
                    <span class="inline-flex items-center gap-1.5 text-xs text-muted">
                      <UIcon name="i-lucide-calendar-days" class="size-4" aria-hidden="true" />
                      {{ formatSessionDate(session.playedAt) }}
                    </span>
                  </div>
                  <p class="line-clamp-2 text-sm text-muted">{{ session.notes || 'No session notes yet.' }}</p>
                  <span class="inline-flex items-center gap-1 text-xs text-muted group-hover:text-highlighted">Open session <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /></span>
                </div>
              </NuxtLink>
            </li>
          </ol>
        </UCard>
      </SharedResourceState>
    </CampaignListTemplate>

    <SharedEntityFormModal
v-model:open="isCreateOpen"
:schema="sessionFormSchema"
      :state="createForm"
      title="Create session"
      :saving="isCreating"
      :error="createError"
      submit-label="Create"
      @submit="createSession"
    >
      <SessionFormFields
        :form="createForm"
        :notes-rows="4"
        @update:form="Object.assign(createForm, $event)"
      />
    </SharedEntityFormModal>
  </div>
</template>


