<script setup lang="ts">
definePageMeta({ layout: 'app' })

type SessionDetail = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  notes?: string | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const sessionId = computed(() => route.params.sessionId as string)
const { request } = useApi()

const { data: session, pending, refresh, error } = await useAsyncData(
  () => `session-${sessionId.value}`,
  () => request<SessionDetail>(`/api/sessions/${sessionId.value}`)
)

const form = reactive({
  title: '',
  sessionNumber: '',
  playedAt: '',
  notes: '',
})
const isSaving = ref(false)
const saveError = ref('')

watch(
  () => session.value,
  (value) => {
    form.title = value?.title || ''
    form.sessionNumber = value?.sessionNumber?.toString() || ''
    form.playedAt = value?.playedAt ? value.playedAt.slice(0, 10) : ''
    form.notes = value?.notes || ''
  },
  { immediate: true }
)

const saveSession = async () => {
  saveError.value = ''
  isSaving.value = true
  try {
    await request(`/api/sessions/${sessionId.value}`, {
      method: 'PATCH',
      body: {
        title: form.title || undefined,
        sessionNumber: form.sessionNumber ? Number(form.sessionNumber) : undefined,
        playedAt: form.playedAt ? new Date(form.playedAt).toISOString() : null,
        notes: form.notes || null,
      },
    })
    await refresh()
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to update session.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">Session</p>
        <h1 class="mt-2 text-2xl font-semibold">{{ session?.title || 'Session detail' }}</h1>
      </div>
      <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">Back to sessions</UButton>
    </div>

    <div v-if="pending" class="grid gap-4">
      <UCard class="h-28 animate-pulse bg-white/80 dark:bg-slate-900/40" />
      <UCard class="h-40 animate-pulse bg-white/80 dark:bg-slate-900/40" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-dashed border-red-900/60 p-10 text-center">
      <p class="text-sm text-red-300">Unable to load this session.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </div>

    <div v-else class="space-y-6">
      <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Session details</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">Keep the record current.</p>
          </div>
        </template>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Title</label>
            <UInput v-model="form.title" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Session number</label>
              <UInput v-model="form.sessionNumber" type="number" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Played at</label>
              <UInput v-model="form.playedAt" type="date" />
            </div>
          </div>
          <div>
            <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Notes</label>
            <UTextarea v-model="form.notes" :rows="6" />
          </div>
          <p v-if="saveError" class="text-sm text-red-300">{{ saveError }}</p>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton :loading="isSaving" @click="saveSession">Save changes</UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
