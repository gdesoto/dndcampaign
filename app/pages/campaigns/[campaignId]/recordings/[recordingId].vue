<script setup lang="ts">
definePageMeta({ layout: 'app' })

type RecordingDetail = {
  id: string
  sessionId: string
  kind: 'AUDIO' | 'VIDEO'
  filename: string
  mimeType: string
  byteSize: number
  durationSeconds?: number | null
  artifactId: string
  createdAt: string
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const recordingId = computed(() => route.params.recordingId as string)
const { request } = useApi()

const { data: recording, pending, refresh, error } = await useAsyncData(
  () => `recording-${recordingId.value}`,
  () => request<RecordingDetail>(`/api/recordings/${recordingId.value}`)
)

const { data: playbackUrl, pending: playbackPending } = await useAsyncData(
  () => `recording-playback-${recordingId.value}`,
  async () => {
    const payload = await request<{ url: string }>(
      `/api/recordings/${recordingId.value}/playback-url`
    )
    return payload.url
  }
)

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
  <UPage>
    <div class="space-y-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
            Recording
          </p>
          <h1 class="mt-2 text-2xl font-semibold">{{ recording?.filename || 'Recording detail' }}</h1>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="recording"
            variant="outline"
            :to="`/campaigns/${campaignId}/sessions/${recording.sessionId}`"
          >
            Back to session
          </UButton>
          <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">
            All sessions
          </UButton>
        </div>
      </div>

      <div v-if="pending" class="grid gap-4">
        <UCard class="h-32 animate-pulse bg-white/80 dark:bg-slate-900/40" />
        <UCard class="h-52 animate-pulse bg-white/80 dark:bg-slate-900/40" />
      </div>

      <div v-else-if="error" class="rounded-xl border border-dashed border-red-900/60 p-10 text-center">
        <p class="text-sm text-red-300">Unable to load this recording.</p>
        <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
      </div>

      <div v-else-if="recording" class="space-y-6">
        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Playback</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Streamed directly from storage.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <div v-if="playbackPending" class="text-sm text-slate-500 dark:text-slate-400">
              Preparing playback...
            </div>
            <audio
              v-else-if="recording.kind === 'AUDIO' && playbackUrl"
              class="w-full"
              controls
              preload="metadata"
              :src="playbackUrl"
            />
            <video
              v-else-if="recording.kind === 'VIDEO' && playbackUrl"
              class="w-full rounded-lg"
              controls
              preload="metadata"
              :src="playbackUrl"
            />
            <p v-else class="text-sm text-slate-500 dark:text-slate-400">
              Playback is not available right now.
            </p>
          </div>
        </UCard>

        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Details</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">Recording metadata.</p>
            </div>
          </template>
          <div class="grid gap-4 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Kind</p>
              <p class="mt-1 font-semibold">{{ recording.kind }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Size</p>
              <p class="mt-1 font-semibold">{{ formatBytes(recording.byteSize) }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Mime type</p>
              <p class="mt-1 font-semibold">{{ recording.mimeType }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Uploaded</p>
              <p class="mt-1 font-semibold">{{ new Date(recording.createdAt).toLocaleString() }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UPage>
</template>
