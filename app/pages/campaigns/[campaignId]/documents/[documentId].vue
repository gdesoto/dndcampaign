<script setup lang="ts">
definePageMeta({ layout: 'app' })

type DocumentVersion = {
  id: string
  content: string
  format: 'MARKDOWN' | 'PLAINTEXT'
  versionNumber: number
  source: string
  createdAt: string
}

type DocumentDetail = {
  id: string
  type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
  title: string
  sessionId?: string | null
  currentVersionId?: string | null
  currentVersion?: DocumentVersion | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const documentId = computed(() => route.params.documentId as string)
const { request } = useApi()

const { data: document, pending, refresh, error } = await useAsyncData(
  () => `document-${documentId.value}`,
  () => request<DocumentDetail>(`/api/documents/${documentId.value}`)
)

const { data: versions, refresh: refreshVersions } = await useAsyncData(
  () => `document-versions-${documentId.value}`,
  () => request<DocumentVersion[]>(`/api/documents/${documentId.value}/versions`)
)

const content = ref('')
const saveError = ref('')
const isSaving = ref(false)
const restoreError = ref('')
const importing = ref(false)
const importError = ref('')
const importFile = ref<File | null>(null)

watch(
  () => document.value,
  (value) => {
    content.value = value?.currentVersion?.content || ''
  },
  { immediate: true }
)

const saveDocument = async () => {
  saveError.value = ''
  isSaving.value = true
  try {
    await request(`/api/documents/${documentId.value}`, {
      method: 'PATCH',
      body: {
        content: content.value,
        format: 'MARKDOWN',
      },
    })
    await refresh()
    await refreshVersions()
  } catch (error) {
    saveError.value =
      (error as Error & { message?: string }).message || 'Unable to save document.'
  } finally {
    isSaving.value = false
  }
}

const restoreVersion = async (versionId: string) => {
  restoreError.value = ''
  try {
    await request(`/api/documents/${documentId.value}/restore`, {
      method: 'POST',
      body: { versionId },
    })
    await refresh()
    await refreshVersions()
  } catch (error) {
    restoreError.value =
      (error as Error & { message?: string }).message || 'Unable to restore version.'
  }
}

const importDocument = async () => {
  if (!importFile.value || !document.value?.sessionId) return
  importError.value = ''
  importing.value = true
  try {
    const formData = new FormData()
    formData.append('file', importFile.value)
    formData.append('type', document.value.type)
    await request(`/api/sessions/${document.value.sessionId}/documents/import`, {
      method: 'POST',
      body: formData,
    })
    importFile.value = null
    await refresh()
    await refreshVersions()
  } catch (error) {
    importError.value =
      (error as Error & { message?: string }).message || 'Import failed.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <UPage>
    <div class="space-y-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">
            Document
          </p>
          <h1 class="mt-2 text-2xl font-semibold">
            {{ document?.title || 'Document editor' }}
          </h1>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="document?.sessionId"
            variant="outline"
            :to="`/campaigns/${campaignId}/sessions/${document.sessionId}`"
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
        <p class="text-sm text-red-300">Unable to load this document.</p>
        <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Editor</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Markdown-first editor with version tracking.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <UTextarea v-model="content" :rows="14" />
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="isSaving" @click="saveDocument">Save version</UButton>
              <div class="flex items-center gap-2">
                <input
                  class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                  type="file"
                  accept=".txt,.md,.markdown,.vtt"
                  @change="importFile = ($event.target as HTMLInputElement).files?.[0] || null"
                />
                <UButton
                  :disabled="!document?.sessionId"
                  :loading="importing"
                  variant="outline"
                  @click="importDocument"
                >
                  Import file
                </UButton>
              </div>
            </div>
            <p v-if="saveError" class="text-sm text-red-300">{{ saveError }}</p>
            <p v-if="importError" class="text-sm text-red-300">{{ importError }}</p>
          </div>
        </UCard>

        <UCard class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Version history</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Restore any previous version.
              </p>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="version in versions"
              :key="version.id"
              class="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="font-semibold">Version {{ version.versionNumber }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-500">
                    {{ new Date(version.createdAt).toLocaleString() }} · {{ version.source }}
                  </p>
                </div>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="document?.currentVersionId === version.id"
                  @click="restoreVersion(version.id)"
                >
                  Restore
                </UButton>
              </div>
            </div>
            <p v-if="!versions?.length" class="text-sm text-slate-600 dark:text-slate-400">
              No versions yet.
            </p>
            <p v-if="restoreError" class="text-sm text-red-300">{{ restoreError }}</p>
          </div>
        </UCard>
      </div>
    </div>
  </UPage>
</template>
