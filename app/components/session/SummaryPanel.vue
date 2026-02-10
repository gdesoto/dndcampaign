<script setup lang="ts">
const props = defineProps<{
  campaignId: string
  returnToPath?: string
  selectedSummaryJobId: string
  summaryJobOptions: Array<{ label: string; value: string }>
  summarySending: boolean
  hasTranscript: boolean
  summaryStatusColor: string
  summaryStatusLabel: string
  summaryTrackingId?: string
  summaryPendingText: string
  summaryHighlights: unknown[]
  summarySessionTags: unknown[]
  summaryNotableDialogue: unknown[]
  summaryConcreteFacts: unknown[]
  summarySendError: string
  summaryActionError: string
  summaryContent: string
  summarySaving: boolean
  summaryDocId?: string
  summaryFile: File | null
  summaryImporting: boolean
  summaryError: string
  summaryImportError: string
}>()

const emit = defineEmits<{
  'update:selectedSummaryJobId': [value: string]
  'refresh-jobs': []
  'send-to-n8n': []
  'apply-pending-summary': []
  'update:summaryContent': [value: string]
  'save-summary': []
  'update:summaryFile': [value: File | null]
  'import-summary': []
}>()

const selectedSummaryJobIdModel = computed({
  get: () => props.selectedSummaryJobId,
  set: (value: string | number | undefined) => emit('update:selectedSummaryJobId', String(value || '')),
})

const summaryContentModel = computed({
  get: () => props.summaryContent,
  set: (value: string) => emit('update:summaryContent', value),
})

const summaryFileModel = computed({
  get: () => props.summaryFile,
  set: (value: File | null | undefined) => emit('update:summaryFile', value ?? null),
})
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">n8n summarization</h2>
          <p class="text-sm text-muted">
            Send the transcript to n8n and review summary content.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <USelect
            v-model="selectedSummaryJobIdModel"
            :items="summaryJobOptions"
            placeholder="Select summary job"
          />
          <UButton size="sm" variant="outline" @click="emit('refresh-jobs')">
            Refresh jobs
          </UButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            :loading="summarySending"
            :disabled="!hasTranscript"
            @click="emit('send-to-n8n')"
          >
            Send transcript to n8n
          </UButton>
          <UBadge variant="soft" :color="summaryStatusColor" size="sm">
            {{ summaryStatusLabel }}
          </UBadge>
          <span v-if="summaryTrackingId" class="text-xs text-muted">
            {{ summaryTrackingId }}
          </span>
        </div>
        <div v-if="summaryPendingText" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Pending summary</p>
          <p class="whitespace-pre-line text-sm text-muted">
            {{ summaryPendingText }}
          </p>
          <UButton size="sm" variant="outline" @click="emit('apply-pending-summary')">
            Apply summary
          </UButton>
        </div>
        <div v-if="summaryHighlights.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Key moments</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="highlight in summaryHighlights" :key="String(highlight)">{{ highlight }}</li>
          </ul>
        </div>
        <div v-if="summarySessionTags.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Session tags</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="tag in summarySessionTags"
              :key="String(tag)"
              variant="soft"
              color="secondary"
              size="sm"
            >
              {{ tag }}
            </UBadge>
          </div>
        </div>
        <div v-if="summaryNotableDialogue.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notable dialogue</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="line in summaryNotableDialogue" :key="String(line)">{{ line }}</li>
          </ul>
        </div>
        <div v-if="summaryConcreteFacts.length" class="space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Concrete facts</p>
          <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
            <li v-for="fact in summaryConcreteFacts" :key="String(fact)">{{ fact }}</li>
          </ul>
        </div>
        <p v-if="summarySendError" class="text-sm text-error">{{ summarySendError }}</p>
        <p v-if="summaryActionError" class="text-sm text-error">{{ summaryActionError }}</p>
      </div>
    </UCard>
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">Summary</h2>
          <p class="text-sm text-muted">
            Write a recap or import one.
          </p>
        </div>
      </template>
      <div class="space-y-4">
        <UTextarea v-model="summaryContentModel" :rows="5" />
        <div class="flex flex-wrap items-center gap-3">
          <UButton :loading="summarySaving" @click="emit('save-summary')">Save summary</UButton>
          <UButton
            v-if="summaryDocId"
            variant="outline"
            :to="props.returnToPath
              ? {
                  path: `/campaigns/${campaignId}/documents/${summaryDocId}`,
                  query: { returnTo: props.returnToPath },
                }
              : `/campaigns/${campaignId}/documents/${summaryDocId}`"
          >
            Open editor
          </UButton>
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <UFileUpload
            v-model="summaryFileModel"
            accept=".txt,.md,.markdown"
            variant="button"
            label="Select summary file"
            :preview="false"
          />
          <UButton :loading="summaryImporting" variant="outline" @click="emit('import-summary')">
            Import file
          </UButton>
        </div>
        <p v-if="summaryError" class="text-sm text-error">{{ summaryError }}</p>
        <p v-if="summaryImportError" class="text-sm text-error">{{ summaryImportError }}</p>
      </div>
    </UCard>
  </div>
</template>
