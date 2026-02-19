import type { Ref } from 'vue'
import type { RecordingKind, SessionRecordingItem } from '#shared/types/session-workflow'

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
  const playbackUrls = reactive<Record<string, string>>({})
  const playbackLoading = reactive<Record<string, boolean>>({})
  const playbackError = ref('')

  const uploadRecording = async () => {
    if (!selectedFile.value) return
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

  const loadPlayback = async (recordingId: string) => {
    const cachedUrl = playbackUrls[recordingId]
    if (cachedUrl) {
      const recording = options.recordings.value?.find((item) => item.id === recordingId)
      if (recording) {
        await player.playSource(
          {
            id: recordingId,
            title: recording.filename,
            subtitle: recording.kind,
            kind: recording.kind,
            src: cachedUrl,
          },
          { presentation: 'global' }
        )
      }
      return
    }

    if (playbackLoading[recordingId]) return

    playbackError.value = ''
    playbackLoading[recordingId] = true
    try {
      const payload = await request<{ url: string }>(`/api/recordings/${recordingId}/playback-url`)
      const playbackUrl = payload?.url
      if (!playbackUrl) throw new Error('Unable to load recording playback URL.')
      playbackUrls[recordingId] = playbackUrl
      const recording = options.recordings.value?.find((item) => item.id === recordingId)
      if (recording) {
        await player.playSource(
          {
            id: recordingId,
            title: recording.filename,
            subtitle: recording.kind,
            kind: recording.kind,
            src: playbackUrl,
          },
          { presentation: 'global' }
        )
      }
    } catch (error) {
      playbackError.value =
        (error as Error & { message?: string }).message || 'Unable to load playback.'
    } finally {
      playbackLoading[recordingId] = false
    }
  }

  return {
    uploadError,
    isUploading,
    selectedFile,
    selectedKind,
    playbackUrls,
    playbackLoading,
    playbackError,
    uploadRecording,
    loadPlayback,
  }
}
