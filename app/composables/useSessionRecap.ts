import type { Ref } from 'vue'
import type { SessionRecapRecording } from '#shared/types/session-workflow'
import { artifactStreamUrl } from '~/utils/artifact'

type UseSessionRecapOptions = {
  sessionId: Ref<string>
  recap: Ref<SessionRecapRecording | null | undefined>
  selectedRecapKind: Ref<'AUDIO' | 'VIDEO'>
  refreshRecap: () => Promise<void>
}

export function useSessionRecap(options: UseSessionRecapOptions) {
  const { request } = useApi()
  const player = useMediaPlayer()

  const recapFile = ref<File | null>(null)
  const recapUploading = ref(false)
  const recapError = ref('')
  const recapPlaybackLoading = ref(false)
  const recapDeleting = ref(false)
  const recapDeleteError = ref('')
  const recapBusy = computed(() => recapUploading.value || recapDeleting.value || recapPlaybackLoading.value)
  const recapPlaying = computed(() => {
    const recap = options.recap.value
    const { source, isPlaying, presentation } = player.state.value
    return Boolean(recap && source && isPlaying && presentation === 'global' && source.id === recap.id
      && source.src === artifactStreamUrl(recap.artifactId)
      && source.kind === (recap.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'))
  })

  watch(
    [() => options.recap.value?.id, () => options.recap.value?.artifactId, options.selectedRecapKind],
    () => {
      recapFile.value = null
      recapError.value = ''
      recapDeleteError.value = ''
    }
  )

  const uploadRecap = async () => {
    if (!recapFile.value || recapBusy.value) return
    recapError.value = ''
    const fileKind = recapFile.value.type.startsWith('video/') ? 'VIDEO' : 'AUDIO'
    if (fileKind !== options.selectedRecapKind.value) {
      recapError.value = `Choose ${options.selectedRecapKind.value === 'AUDIO' ? 'an audio' : 'a video'} file for this recap.`
      return
    }
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
    if (!options.recap.value || recapBusy.value) return
    const { id, artifactId, filename, mimeType } = options.recap.value
    const kind = mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'

    recapError.value = ''
    recapPlaybackLoading.value = true
    try {
      await player.playSource(
        {
          id,
          recapProgressId: id,
          title: filename || 'Recap',
          subtitle: 'Session recap',
          kind,
          src: artifactStreamUrl(artifactId),
        },
        { presentation: 'global', openDrawer: kind === 'VIDEO' }
      )
    } catch (error) {
      if (options.recap.value?.id === id && options.recap.value.artifactId === artifactId && options.selectedRecapKind.value === kind) {
        recapError.value = (error as Error & { message?: string }).message || 'Unable to load recap.'
      }
    } finally {
      recapPlaybackLoading.value = false
    }
  }

  const deleteRecap = async () => {
    if (!options.recap.value || recapBusy.value) return
    const { id, artifactId, mimeType } = options.recap.value
    const deletedSrc = artifactStreamUrl(artifactId)
    const deletedKind = mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
    recapDeleteError.value = ''
    recapDeleting.value = true
    try {
      await request(`/api/recaps/${id}`, {
        method: 'DELETE',
      })
      const source = player.state.value.source
      if (source?.id === id && source.src === deletedSrc && source.kind === deletedKind) player.stop()
      await options.refreshRecap()
    } catch (error) {
      recapDeleteError.value =
        (error as Error & { message?: string }).message || 'Unable to delete recap.'
      throw new Error(recapDeleteError.value, { cause: error })
    } finally {
      recapDeleting.value = false
    }
  }

  return {
    recapFile,
    recapUploading,
    recapError,
    recapPlaying,
    recapPlaybackLoading,
    recapDeleting,
    recapDeleteError,
    uploadRecap,
    loadRecapPlayback,
    deleteRecap,
  }
}
