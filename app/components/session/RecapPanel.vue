<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { recapWatchLink } from '~/utils/recap-links'
import type { SessionRecapRecording } from '#shared/types/session-workflow'

type WorkflowStep = 'recordings' | 'transcription' | 'summary' | 'recap'

const props = defineProps<{
  deleteRecap?: () => Promise<unknown>
  campaignId?: string
  workflowMode: boolean
  openStep?: WorkflowStep
  recap: SessionRecapRecording | null | undefined
  recaps: SessionRecapRecording[]
  selectedKind: 'AUDIO' | 'VIDEO'
  recapFile: File | null
  recapUploading: boolean
  recapPlaybackLoading: boolean
  recapDeleting: boolean
  recapPlaybackUrl: string
  recapError: string
  recapDeleteError: string
  hasRecap: boolean
}>()

const emit = defineEmits<{
  'update:selectedKind': [value: 'AUDIO' | 'VIDEO']
  'update:recapFile': [value: File | null]
  'upload-recap': []
  'play-recap': []
  'open-player': []
  'open-step': [step: WorkflowStep]
}>()

const recapFileModel = computed({
  get: () => props.recapFile,
  set: (value: File | null | undefined) => emit('update:recapFile', value ?? null),
})

const toast = useToast()
const mediaKinds = ['AUDIO', 'VIDEO'] as const
const kindLabel = computed(() => props.selectedKind === 'VIDEO' ? 'Video' : 'Audio')
const acceptedTypes = computed(() => props.selectedKind === 'VIDEO'
  ? 'video/mp4,video/webm,video/ogg'
  : 'audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg')
const hasKind = (kind: 'AUDIO' | 'VIDEO') => props.recaps.some((item) =>
  (item.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO') === kind
)
const isReplaceModalOpen = ref(false)
watch(() => props.selectedKind, () => { isReplaceModalOpen.value = false })
const { formatBytes } = useFormatBytes()

const openReplaceModal = () => {
  recapFileModel.value = null
  isReplaceModalOpen.value = true
}

const submitReplace = () => {
  if (!recapFileModel.value) return
  emit('upload-recap')
}

watch(
  () => props.recapUploading,
  (isUploading, wasUploading) => {
    if (wasUploading && !isUploading && !props.recapError) {
      isReplaceModalOpen.value = false
    }
  }
)

const recapActions = computed<RecordAction[]>(() => {
  const recap = props.recap
  if (!recap) return []
  const url = props.campaignId ? recapWatchLink(`/campaigns/${props.campaignId}`, recap.id) : ''
  return [
    ...(url ? [
      { label: 'Open playlist', icon: 'i-lucide-list-video', to: url },
      { label: 'Copy campaign link', icon: 'i-lucide-link', action: async () => { await navigator.clipboard.writeText(new URL(url, window.location.origin).href); toast.add({ title: 'Campaign link copied', color: 'success' }) } },
    ] : []),
    ...(props.workflowMode ? [{ label: 'Replace recap', icon: 'i-lucide-refresh-cw', action: openReplaceModal }] : []),
    ...(props.workflowMode && props.deleteRecap ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: async () => {
      if (props.recap?.id !== recap.id) throw new Error('The selected recap changed. Close this prompt and choose the recap again.')
      await props.deleteRecap!()
    }, confirmation: { label: 'Delete recap', message: `Delete recap "${recap.filename}"? This permanently removes its file.` } }] : []),
  ]
})

</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Session recaps</h2>
          <p class="text-sm text-muted">
            {{
              workflowMode
                ? 'Keep both an audio and a video recap for this session.'
              : 'Choose an audio or video recap to play.'
            }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge v-if="hasRecap" color="success" variant="soft">Attached</UBadge>
          <SessionStepLinkButton
            v-if="openStep"
            :step="openStep"
            @open="(step) => emit('open-step', step as WorkflowStep)"
          />
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Recap type">
        <UButton
          v-for="kind in mediaKinds"
          :key="kind"
          :variant="selectedKind === kind ? 'solid' : 'outline'"
          :aria-pressed="selectedKind === kind"
          :icon="kind === 'VIDEO' ? 'i-lucide-video' : 'i-lucide-headphones'"
          :disabled="recapUploading || recapDeleting || recapPlaybackLoading"
          @click="emit('update:selectedKind', kind)"
        >
          {{ kind === 'VIDEO' ? 'Video' : 'Audio' }} · {{ hasKind(kind) ? 'Attached' : 'Not uploaded' }}
        </UButton>
      </div>
      <p v-if="workflowMode" class="text-xs text-muted">One audio and one video recap per session, up to 512 MB each. Replacing a recap only replaces the same media type. Video formats: MP4, WebM, Ogg.</p>
      <p v-if="!hasRecap" class="text-sm text-muted">No {{ kindLabel.toLowerCase() }} recap uploaded.</p>
      <div
        v-if="workflowMode && !hasRecap"
        class="flex flex-col gap-3 rounded-md border border-default bg-elevated/40 p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.2em] text-muted">{{ kindLabel }} recap</p>
          <p class="truncate text-sm text-muted">
            {{
              recapFile?.name
                || (hasRecap ? 'A recap is currently attached.' : 'No file selected')
            }}
          </p>
        </div>

        <UFileUpload
          v-model="recapFileModel"
          :accept="acceptedTypes"
          variant="button"
          size="sm"
          :dropzone="false"
          :preview="false"
          label="Choose file"
          class="shrink-0"
        />
      </div>

      <div v-if="hasRecap && recap" class="rounded-md border border-default bg-elevated/30 p-3">
        <p class="text-xs uppercase tracking-[0.2em] text-muted">{{ recap.mimeType.startsWith('video/') ? 'Video recap' : 'Audio recap' }}</p>
        <div class="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <p><span class="text-muted">File:</span> {{ recap.filename || 'Unknown' }}</p>
          <p><span class="text-muted">Type:</span> {{ recap.mimeType || 'Unknown' }}</p>
          <p><span class="text-muted">Size:</span> {{ formatBytes(recap.byteSize) }}</p>
          <p><span class="text-muted">Uploaded:</span> {{ new Date(recap.createdAt).toLocaleString() }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 sm:justify-end">

        <UButton
          v-if="workflowMode && !hasRecap"
          size="sm"
          icon="i-lucide-upload"
          :disabled="!recapFile"
          :loading="recapUploading"
          class="w-full sm:w-auto"
          @click="emit('upload-recap')"
        >
          Upload recap
        </UButton>

        <UButton
          size="sm"
          variant="outline"
          icon="i-lucide-play"
          :disabled="!hasRecap"
          :loading="recapPlaybackLoading"
          class="w-full sm:w-auto"
          @click="emit('play-recap')"
        >
          Play recap
        </UButton>
        <SharedActionMenu v-if="recap" :name="recap.filename || 'recap'" :items="recapActions" :disabled="recapUploading || recapDeleting" />
      </div>

      <UCard v-if="recapPlaybackUrl">
        <div class="flex items-center justify-between gap-3 text-xs text-muted">
          <span>Recap is playing in the global player.</span>
          <UButton size="xs" variant="ghost" @click="emit('open-player')">
            Open player
          </UButton>
        </div>
      </UCard>

      <p v-if="recapError" class="text-sm text-error">{{ recapError }}</p>
      <p v-if="recapDeleteError" class="text-sm text-error">{{ recapDeleteError }}</p>
    </div>
  </UCard>

  <UModal v-model:open="isReplaceModalOpen">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">Replace {{ kindLabel.toLowerCase() }} recap</h3>
        </template>

        <div class="space-y-4">
          <UFileUpload
            v-model="recapFileModel"
            :accept="acceptedTypes"
            variant="button"
            size="sm"
            :dropzone="false"
            :preview="false"
            label="Choose replacement"
            :disabled="recapUploading || recapDeleting"
          />

          <p class="text-sm text-muted">
            {{ recapFile?.name || 'No file selected.' }}
          </p>

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" :disabled="recapUploading || recapDeleting" @click="() => { isReplaceModalOpen = false }">Cancel</UButton>
            <UButton :disabled="!recapFile" :loading="recapUploading" @click="submitReplace">
              Replace recap
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

