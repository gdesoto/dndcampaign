import type { Ref } from 'vue'
import type { RecordingKind, SessionRecordingItem } from '#shared/types/session-workflow'
import { artifactStreamUrl } from '~/utils/artifact'

type UseSessionRecordingsOptions = {
  sessionId: Ref<string>
  recordings: Ref<SessionRecordingItem[] | null | undefined>
  refreshRecordings: () => Promise<void>
}

export function useSessionRecordings(options: UseSessionRecordingsOptions) {
  const { request } = useApi()
  const player = useMediaPlayer()

  const uploadError = ref('')
  const isUploading = ref(false)
  const selectedFile = ref<File | null>(null)
  const selectedKind = ref<RecordingKind>('AUDIO')
  const deletingRecordingId = ref('')
  const deleteError = ref('')
  const matchingRecording = computed(() => {
    const source = player.state.value.source
    if (!source) return undefined
    return options.recordings.value?.find(recording => recording.id === source.id
      && recording.kind === source.kind && artifactStreamUrl(recording.artifactId) === source.src)
  })
  const loadingRecordingId = computed(() => player.state.value.autoplay ? matchingRecording.value?.id || '' : '')
  const playingRecordingId = computed(() => player.state.value.isPlaying && player.state.value.presentation === 'global'
    ? matchingRecording.value?.id || '' : '')
  const playbackError = computed(() => matchingRecording.value ? player.state.value.error : '')

  const uploadRecording = async () => {
    if (!selectedFile.value || isUploading.value || deletingRecordingId.value) return
    uploadError.value = ''
    isUploading.value = true
    try {
      const formData = new FormData()
      formData.append('file', selectedFile.value)
      formData.append('kind', selectedKind.value)
      await request(`/api/sessions/${options.sessionId.value}/recordings`, {
        method: 'POST',
        body: formData,
      })
      selectedFile.value = null
      await options.refreshRecordings()
    } catch (error) {
      uploadError.value =
        (error as Error & { message?: string }).message || 'Unable to upload recording.'
    } finally {
      isUploading.value = false
    }
  }

  const loadPlayback = (recordingId: string) => {
    if (loadingRecordingId.value === recordingId || deletingRecordingId.value === recordingId) return
    const recording = options.recordings.value?.find(item => item.id === recordingId)
    if (!recording) return
    const { id, artifactId, kind, filename } = recording

    return player.playSource(
      { id, title: filename, subtitle: kind, kind, src: artifactStreamUrl(artifactId) },
      { presentation: 'global' }
    )
  }

  const deleteRecording = async (recordingId: string) => {
    if (!recordingId || deletingRecordingId.value || isUploading.value || loadingRecordingId.value === recordingId) return
    const recording = options.recordings.value?.find(item => item.id === recordingId)
    const deletedSrc = recording ? artifactStreamUrl(recording.artifactId) : ''
    const deletedKind = recording?.kind

    deleteError.value = ''
    deletingRecordingId.value = recordingId

    try {
      await request(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      })
      const source = player.state.value.source
      if (source?.id === recordingId && source.src === deletedSrc && source.kind === deletedKind) player.stop()
      await options.refreshRecordings()
    } catch (error) {
      deleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete recording.'
      throw new Error(deleteError.value, { cause: error })
    } finally {
      deletingRecordingId.value = ''
    }
  }

  return {
    uploadError,
    isUploading,
    selectedFile,
    selectedKind,
    playingRecordingId,
    loadingRecordingId,
    playbackError,
    deletingRecordingId,
    deleteError,
    uploadRecording,
    loadPlayback,
    deleteRecording,
  }
}
