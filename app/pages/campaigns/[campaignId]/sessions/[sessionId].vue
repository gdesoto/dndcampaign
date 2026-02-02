<script setup lang="ts">
definePageMeta({ layout: 'app' })

type SessionDetail = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  notes?: string | null
}

type RecordingItem = {
  id: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
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
const uploadError = ref('')
const isUploading = ref(false)
const selectedFile = ref<File | null>(null)
const selectedKind = ref<'AUDIO' | 'VIDEO'>('AUDIO')
const playbackUrls = reactive<Record<string, string>>({})
const playbackLoading = reactive<Record<string, boolean>>({})
const playbackError = ref('')

const { data: recordings, refresh: refreshRecordings } = await useAsyncData(
  () => `recordings-${sessionId.value}`,
  () => request<RecordingItem[]>(`/api/sessions/${sessionId.value}/recordings`)
)

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

const uploadRecording = async () => {
  if (!selectedFile.value) return
  uploadError.value = ''
  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('kind', selectedKind.value)
    await request(`/api/sessions/${sessionId.value}/recordings`, {
      method: 'POST',
      body: formData,
    })
    selectedFile.value = null
    await refreshRecordings()
  } catch (error) {
    uploadError.value =
      (error as Error & { message?: string }).message || 'Unable to upload recording.'
  } finally {
    isUploading.value = false
  }
}

const loadPlayback = async (recordingId: string) => {
  if (playbackUrls[recordingId] || playbackLoading[recordingId]) return
  playbackError.value = ''
  playbackLoading[recordingId] = true
  try {
    const payload = await request<{ url: string }>(
      `/api/recordings/${recordingId}/playback-url`
    )
    playbackUrls[recordingId] = payload.url
  } catch (error) {
    playbackError.value =
      (error as Error & { message?: string }).message || 'Unable to load playback.'
  } finally {
    playbackLoading[recordingId] = false
  }
}

const formatBytes = (value: number) => {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
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

      <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Recordings</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">Upload and review session media.</p>
          </div>
        </template>
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">File</label>
              <input
                class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                type="file"
                accept="audio/*,video/*"
                @change="selectedFile = ($event.target as HTMLInputElement).files?.[0] || null"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Kind</label>
              <select
                v-model="selectedKind"
                class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              >
                <option value="AUDIO">Audio</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <UButton :loading="isUploading" @click="uploadRecording">Upload recording</UButton>
            <span v-if="isUploading" class="text-xs text-slate-500 dark:text-slate-400">
              Uploading...
            </span>
            <p v-if="uploadError" class="text-sm text-red-300">{{ uploadError }}</p>
          </div>
          <p v-if="playbackError" class="text-sm text-red-300">{{ playbackError }}</p>
          <div v-if="recordings?.length" class="space-y-3">
            <div
              v-for="recording in recordings"
              :key="recording.id"
              class="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold">{{ recording.filename }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-500">
                    {{ recording.kind }} - {{ formatBytes(recording.byteSize) }} - {{ new Date(recording.createdAt).toLocaleString() }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    size="xs"
                    variant="outline"
                    :loading="playbackLoading[recording.id]"
                    @click="loadPlayback(recording.id)"
                  >
                    Play
                  </UButton>
                  <UButton
                    size="xs"
                    variant="outline"
                    :to="`/campaigns/${campaignId}/recordings/${recording.id}`"
                  >
                    Open
                  </UButton>
                </div>
              </div>
              <div v-if="playbackUrls[recording.id]" class="mt-3">
                <audio
                  v-if="recording.kind === 'AUDIO'"
                  class="w-full"
                  controls
                  preload="metadata"
                  :src="playbackUrls[recording.id]"
                />
                <video
                  v-else-if="recording.kind === 'VIDEO'"
                  class="w-full rounded-lg"
                  controls
                  preload="metadata"
                  :src="playbackUrls[recording.id]"
                />
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-slate-600 dark:text-slate-400">No recordings yet.</p>
        </div>
      </UCard>
    </div>
  </div>
</template>


