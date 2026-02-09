<script setup lang="ts">
const props = defineProps<{
  workflowMode: boolean
  openStep?: 'recordings' | 'transcription' | 'summary' | 'recap'
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
  'open-step': [step: 'recordings' | 'transcription' | 'summary' | 'recap']
}>()

const recapFileModel = computed({
  get: () => props.recapFile,
  set: (value: File | null | undefined) => emit('update:recapFile', value ?? null),
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-start justify-between gap-3">
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
        <UTooltip v-if="openStep" text="Open step" :content="{ side: 'left' }">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-square-arrow-out-up-right"
            aria-label="Open step"
            @click="emit('open-step', openStep)"
          />
        </UTooltip>
      </div>
    </template>

    <div class="space-y-4">
      <UFileUpload
        v-if="workflowMode"
        v-model="recapFileModel"
        accept="audio/*"
        variant="area"
        label="Select recap audio"
        :preview="false"
      />

      <div class="flex flex-wrap items-center gap-3">
        <UButton v-if="workflowMode" :loading="recapUploading" @click="emit('upload-recap')">
          Upload recap
        </UButton>
        <UButton
          variant="outline"
          :disabled="!hasRecap"
          :loading="recapPlaybackLoading"
          @click="emit('play-recap')"
        >
          Play recap
        </UButton>
        <UButton
          v-if="workflowMode"
          variant="ghost"
          color="red"
          :disabled="!hasRecap"
          :loading="recapDeleting"
          @click="emit('delete-recap')"
        >
          Delete recap
        </UButton>
        <span v-if="hasRecap" class="text-xs text-success">Attached</span>
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
</template>
