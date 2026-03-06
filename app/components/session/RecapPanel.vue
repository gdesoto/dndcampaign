<script setup lang="ts">
import type { SessionRecapRecording } from '#shared/types/session-workflow'

type WorkflowStep = 'recordings' | 'transcription' | 'summary' | 'recap'

const props = defineProps<{
  workflowMode: boolean
  openStep?: WorkflowStep
  recap: SessionRecapRecording | null | undefined
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
  'update:recapFile': [value: File | null]
  'upload-recap': []
  'play-recap': []
  'delete-recap': []
  'open-player': []
  'open-step': [step: WorkflowStep]
}>()

const recapFileModel = computed({
  get: () => props.recapFile,
  set: (value: File | null | undefined) => emit('update:recapFile', value ?? null),
})

const isReplaceModalOpen = ref(false)
const { formatBytes } = useFormatBytes()

const openReplaceModal = () => {
  recapFileModel.value = null
  isReplaceModalOpen.value = true
}

const submitReplace = () => {
  if (!recapFileModel.value) return
  emit('upload-recap')
  isReplaceModalOpen.value = false
}

</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Recap podcast</h2>
          <p class="text-sm text-muted">
            {{
              workflowMode
                ? 'Upload a short audio recap for this session.'
              : 'Listen to the recap audio.'
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
      <div
        v-if="workflowMode && !hasRecap"
        class="flex flex-col gap-3 rounded-md border border-default bg-elevated/40 p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recap audio</p>
          <p class="truncate text-sm text-muted">
            {{
              recapFile?.name
                || (hasRecap ? 'A recap is currently attached.' : 'No file selected')
            }}
          </p>
        </div>

        <UFileUpload
          v-model="recapFileModel"
          accept="audio/*"
          variant="button"
          size="sm"
          :dropzone="false"
          :preview="false"
          label="Choose file"
          class="shrink-0"
        />
      </div>

      <div v-if="hasRecap && recap" class="rounded-md border border-default bg-elevated/30 p-3">
        <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Recap details</p>
        <div class="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <p><span class="text-dimmed">File:</span> {{ recap.filename || 'Unknown' }}</p>
          <p><span class="text-dimmed">Type:</span> {{ recap.mimeType || 'Unknown' }}</p>
          <p><span class="text-dimmed">Size:</span> {{ formatBytes(recap.byteSize) }}</p>
          <p><span class="text-dimmed">Uploaded:</span> {{ new Date(recap.createdAt).toLocaleString() }}</p>
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
          v-if="workflowMode && hasRecap"
          size="sm"
          variant="outline"
          icon="i-lucide-refresh-cw"
          class="w-full sm:w-auto"
          @click="openReplaceModal"
        >
          Replace recap
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
        <UButton
          v-if="workflowMode"
          size="sm"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          :disabled="!hasRecap"
          :loading="recapDeleting"
          class="w-full sm:w-auto"
          @click="emit('delete-recap')"
        >
          Delete recap
        </UButton>
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
          <h3 class="text-base font-semibold">Replace recap audio</h3>
        </template>

        <div class="space-y-4">
          <UFileUpload
            v-model="recapFileModel"
            accept="audio/*"
            variant="button"
            size="sm"
            :dropzone="false"
            :preview="false"
            label="Choose replacement"
          />

          <p class="text-sm text-muted">
            {{ recapFile?.name || 'No file selected.' }}
          </p>

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="isReplaceModalOpen = false">Cancel</UButton>
            <UButton :disabled="!recapFile" :loading="recapUploading" @click="submitReplace">
              Replace recap
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

