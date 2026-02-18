<script setup lang="ts">
definePageMeta({ layout: 'app' })

type SessionItem = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  notes?: string | null
  createdAt: string
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const { data: sessions, pending, refresh, error } = await useAsyncData(
  () => `sessions-${campaignId.value}`,
  () => request<SessionItem[]>(`/api/campaigns/${campaignId.value}/sessions`)
)

const isCreateOpen = ref(false)
const createForm = reactive({
  title: '',
  sessionNumber: '',
  playedAt: '',
  notes: '',
})
const createError = ref('')
const isCreating = ref(false)

const openCreate = () => {
  if (!canWriteContent.value) return
  createError.value = ''
  createForm.title = ''
  createForm.sessionNumber = ''
  createForm.playedAt = ''
  createForm.notes = ''
  isCreateOpen.value = true
}

const createSession = async () => {
  if (!canWriteContent.value) return
  createError.value = ''
  isCreating.value = true
  try {
    const payload = {
      title: createForm.title,
      sessionNumber: createForm.sessionNumber ? Number(createForm.sessionNumber) : undefined,
      playedAt: createForm.playedAt ? new Date(createForm.playedAt).toISOString() : undefined,
      notes: createForm.notes || undefined,
    }
    const created = await request<SessionItem>(
      `/api/campaigns/${campaignId.value}/sessions`,
      {
        method: 'POST',
        body: payload,
      }
    )
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
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Sessions</p>
        <h1 class="mt-2 text-2xl font-semibold">Session log</h1>
      </div>
      <UButton size="lg" :disabled="!canWriteContent" @click="openCreate">New session</UButton>
    </div>
    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="Your role can view sessions but cannot create or edit them."
    />

    <SharedResourceState
      :pending="pending"
      :error="error"
      :empty="!sessions?.length"
      error-message="Unable to load sessions."
      empty-message="No sessions yet."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard v-for="i in 3" :key="i" class="h-28 animate-pulse" />
        </div>
      </template>
      <template #emptyActions>
        <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first session</UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <NuxtLink
          v-for="session in sessions"
          :key="session.id"
          :to="`/campaigns/${campaignId}/sessions/${session.id}`"
        >
          <SharedListItemCard>
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-dimmed">
                    Session {{ session.sessionNumber ?? '—' }}
                  </p>
                  <h3 class="text-lg font-semibold">{{ session.title }}</h3>
                </div>
                <span class="text-xs text-muted">
                  {{ session.playedAt ? new Date(session.playedAt).toLocaleDateString() : 'Unscheduled' }}
                </span>
              </div>
            </template>
            <p class="text-sm text-default line-clamp-2">
              {{ session.notes || 'Add notes to capture what happened.' }}
            </p>
          </SharedListItemCard>
        </NuxtLink>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isCreateOpen"
      title="Create session"
      :saving="isCreating"
      :error="createError"
      submit-label="Create"
      @submit="createSession"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="createForm.title" placeholder="The Glass Crypt" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Session number" name="sessionNumber">
          <UInput v-model="createForm.sessionNumber" type="number" placeholder="12" />
        </UFormField>
        <UFormField label="Played at" name="playedAt">
          <UInput v-model="createForm.playedAt" type="date" />
        </UFormField>
      </div>
      <UFormField label="Notes" name="notes">
        <UTextarea v-model="createForm.notes" :rows="4" placeholder="Quick recap..." />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>
