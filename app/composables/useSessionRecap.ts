import type { Ref } from 'vue'
import type { SessionRecapRecording } from '#shared/types/session-workflow'

type UseSessionRecapOptions = {
  sessionId: Ref<string>
  recap: Ref<SessionRecapRecording | null | undefined>
  refreshRecap: () => Promise<void>
}

export function useSessionRecap(options: UseSessionRecapOptions) {
  const { request } = useApi()
  const player = useMediaPlayer()

  const recapFile = ref<File | null>(null)
  const recapUploading = ref(false)
  const recapError = ref('')
  const recapPlaybackUrl = ref('')
  const recapPlaybackLoading = ref(false)
  const recapDeleting = ref(false)
  const recapDeleteError = ref('')

  watch(
    () => options.recap.value,
    () => {
      recapPlaybackUrl.value = ''
    }
  )

  const uploadRecap = async () => {
    if (!recapFile.value) return
    recapError.value = ''
    recapUploading.value = true
    try {
      const formData = new FormData()
      formData.append('file', recapFile.value)
      await request(`/api/sessions/${options.sessionId.value}/recap`, {
        method: 'POST',
        body: formData,
      })
      recapFile.value = null
      await options.refreshRecap()
    } catch (error) {
      recapError.value =
        (error as Error & { message?: string }).message || 'Unable to upload recap.'
    } finally {
      recapUploading.value = false
    }
  }

  const loadRecapPlayback = async () => {
    if (!options.recap.value) return
    if (recapPlaybackUrl.value) {
      await player.playSource(
        {
          id: options.recap.value.id,
          title: options.recap.value.filename || 'Recap',
          subtitle: 'Recap audio',
          kind: 'AUDIO',
          src: recapPlaybackUrl.value,
        },
        { presentation: 'global' }
      )
      return
    }
    if (recapPlaybackLoading.value) return

    recapPlaybackLoading.value = true
    try {
      const payload = await request<{ url: string }>(`/api/recaps/${options.recap.value.id}/playback-url`)
      const playbackUrl = payload?.url
      if (!playbackUrl) throw new Error('Unable to load recap playback URL.')
      recapPlaybackUrl.value = playbackUrl
      await player.playSource(
        {
          id: options.recap.value.id,
          title: options.recap.value.filename || 'Recap',
          subtitle: 'Recap audio',
          kind: 'AUDIO',
          src: playbackUrl,
        },
        { presentation: 'global' }
      )
    } catch (error) {
      recapError.value =
        (error as Error & { message?: string }).message || 'Unable to load recap.'
    } finally {
      recapPlaybackLoading.value = false
    }
  }

  const deleteRecap = async () => {
    if (!options.recap.value) return
    recapDeleteError.value = ''
    recapDeleting.value = true
    try {
      await request(`/api/recaps/${options.recap.value.id}`, {
        method: 'DELETE',
      })
      recapPlaybackUrl.value = ''
      await options.refreshRecap()
    } catch (error) {
      recapDeleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete recap.'
    } finally {
      recapDeleting.value = false
    }
  }

  return {
    recapFile,
    recapUploading,
    recapError,
    recapPlaybackUrl,
    recapPlaybackLoading,
    recapDeleting,
    recapDeleteError,
    uploadRecap,
    loadRecapPlayback,
    deleteRecap,
  }
}
