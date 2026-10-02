import type { Ref } from 'vue'
import type { SessionDocumentDetail } from '#shared/types/session-workflow'

type UseSessionDocumentsOptions = {
  sessionId: Ref<string>
  sessionTitle: Ref<string | null | undefined>
  transcriptDoc: Ref<SessionDocumentDetail | null | undefined>
  summaryDoc: Ref<SessionDocumentDetail | null | undefined>
  summaryContent: Ref<string>
  refreshTranscript: () => Promise<void>
  refreshSummary: () => Promise<void>
}

export function useSessionDocuments(options: UseSessionDocumentsOptions) {
  const { request } = useApi()

  const transcriptCreating = ref(false)
  const summarySaving = ref(false)
  const transcriptError = ref('')
  const summaryError = ref('')
  const transcriptImportError = ref('')
  const summaryImportError = ref('')
  const transcriptImporting = ref(false)
  const summaryImporting = ref(false)
  const transcriptFile = ref<File | null>(null)
  const summaryFile = ref<File | null>(null)
  const transcriptDeleting = ref(false)
  const transcriptDeleteError = ref('')
  const transcriptBusy = computed(() => transcriptCreating.value || transcriptImporting.value || transcriptDeleting.value)

  const createDocument = async (type: 'TRANSCRIPT' | 'SUMMARY', content = '') => {
    const titleBase = type === 'SUMMARY' ? 'Summary' : 'Transcript'
    const title = options.sessionTitle.value ? `${titleBase}: ${options.sessionTitle.value}` : titleBase
    return request<SessionDocumentDetail>(`/api/sessions/${options.sessionId.value}/documents`, {
      method: 'POST',
      body: {
        type,
        title,
        content,
        format: type === 'TRANSCRIPT' ? 'PLAINTEXT' : 'MARKDOWN',
      },
    })
  }

  const createTranscript = async () => {
    if (options.transcriptDoc.value || transcriptBusy.value) return
    transcriptError.value = ''
    transcriptCreating.value = true
    try {
      await createDocument('TRANSCRIPT')
      await options.refreshTranscript()
    } catch (error) {
      transcriptError.value =
        (error as Error & { message?: string }).message || 'Unable to create transcript.'
    } finally {
      transcriptCreating.value = false
    }
  }

  const saveSummary = async () => {
    if (summarySaving.value || summaryImporting.value) return false
    summaryError.value = ''
    summarySaving.value = true
    try {
      if (!options.summaryDoc.value) {
        await createDocument('SUMMARY', options.summaryContent.value)
      } else {
        await request(`/api/documents/${options.summaryDoc.value.id}`, {
          method: 'PATCH',
          body: {
            content: options.summaryContent.value,
            format: 'MARKDOWN',
          },
        })
      }
      await options.refreshSummary()
      return true
    } catch (error) {
      summaryError.value =
        (error as Error & { message?: string }).message || 'Unable to save summary.'
      return false
    } finally {
      summarySaving.value = false
    }
  }

  const importDocument = async (
    type: 'TRANSCRIPT' | 'SUMMARY',
    file: File | null,
    setError: (value: string) => void,
    setLoading: (value: boolean) => void,
    refreshDocument: () => Promise<void>
  ) => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      await request(`/api/sessions/${options.sessionId.value}/documents/import`, {
        method: 'POST',
        body: formData,
      })
      await refreshDocument()
    } catch (error) {
      setError((error as Error & { message?: string }).message || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  const importTranscript = async () => {
    if (transcriptBusy.value || !transcriptFile.value) return
    await importDocument(
      'TRANSCRIPT',
      transcriptFile.value,
      (value) => {
        transcriptImportError.value = value
      },
      (value) => {
        transcriptImporting.value = value
      },
      options.refreshTranscript
    )
    if (!transcriptImportError.value) transcriptFile.value = null
  }

  const importSummary = async () => {
    await importDocument(
      'SUMMARY',
      summaryFile.value,
      (value) => {
        summaryImportError.value = value
      },
      (value) => {
        summaryImporting.value = value
      },
      options.refreshSummary
    )
    if (!summaryImportError.value) summaryFile.value = null
  }

  const deleteTranscript = async () => {
    if (!options.transcriptDoc.value || transcriptBusy.value) return
    transcriptDeleteError.value = ''
    transcriptDeleting.value = true
    try {
      await request(`/api/documents/${options.transcriptDoc.value.id}`, {
        method: 'DELETE',
      })
      await options.refreshTranscript()
    } catch (error) {
      transcriptDeleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete transcript.'
      throw new Error(transcriptDeleteError.value, { cause: error })
    } finally {
      transcriptDeleting.value = false
    }
  }

  return {
    transcriptCreating,
    summarySaving,
    transcriptError,
    summaryError,
    transcriptImportError,
    summaryImportError,
    transcriptImporting,
    summaryImporting,
    transcriptFile,
    summaryFile,
    transcriptDeleting,
    transcriptDeleteError,
    createTranscript,
    saveSummary,
    importTranscript,
    importSummary,
    deleteTranscript,
  }
}
