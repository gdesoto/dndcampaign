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
  createError.value = ''
  createForm.title = ''
  createForm.sessionNumber = ''
  createForm.playedAt = ''
  createForm.notes = ''
  isCreateOpen.value = true
}

const createSession = async () => {
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
      <div class="flex flex-wrap items-center gap-3">
        <UButton variant="outline" :to="`/campaigns/${campaignId}`">Back to campaign</UButton>
        <UButton size="lg" @click="openCreate">New session</UButton>
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="i in 3" :key="i"  class="h-28 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load sessions.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <UCard v-else-if="!sessions?.length" class="text-center">
      <p class="text-sm text-muted">No sessions yet.</p>
      <UButton class="mt-4" variant="outline" @click="openCreate">Create your first session</UButton>
    </UCard>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="session in sessions"
        :key="session.id"
        :to="`/campaigns/${campaignId}/sessions/${session.id}`"
      >
        <UCard  class="transition hover:shadow-lg">
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
        </UCard>
      </NuxtLink>
    </div>

    <UModal v-model:open="isCreateOpen">
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">Create session</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Title</label>
              <UInput v-model="createForm.title" placeholder="The Glass Crypt" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Session number</label>
                <UInput v-model="createForm.sessionNumber" type="number" placeholder="12" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Played at</label>
                <UInput v-model="createForm.playedAt" type="date" />
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Notes</label>
              <UTextarea v-model="createForm.notes" :rows="4" placeholder="Quick recap..." />
            </div>
            <p v-if="createError" class="text-sm text-error">{{ createError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isCreateOpen = false">Cancel</UButton>
              <UButton :loading="isCreating" @click="createSession">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
