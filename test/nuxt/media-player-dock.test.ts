import { expect, it } from 'vitest'
import { defineComponent, h, ref, shallowRef, Suspense } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MediaPlayerDock from '../../app/components/MediaPlayerDock.vue'

mockNuxtImport('onBeforeRouteLeave', () => () => {})
mockNuxtImport('useMediaPlayer', () => () => ({
  state,
  setDockId: (id: string) => { state.value.dockId = id },
  setPresentation: (value: string) => { state.value.presentation = value },
}))
const state = ref({ source: { id: 'recording' }, presentation: 'global', dockId: '' })

it('keeps matching media in the incoming page dock after overlapping page cleanup', async () => {
  const transcript = defineComponent({
    setup: () => () => h(MediaPlayerDock, { sourceId: 'recording', dockId: 'transcript-player-dock' }),
  })
  const recording = defineComponent({
    async setup() {
      await Promise.resolve()
      return () => h(MediaPlayerDock, { sourceId: 'recording', dockId: 'recording-player-dock' })
    },
  })
  const page = shallowRef(transcript)
  const wrapper = await mountSuspended(defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(page.value) }),
  }))
  try {
    expect(state.value).toMatchObject({ presentation: 'page', dockId: 'transcript-player-dock' })
    state.value.presentation = 'global'
    page.value = recording
    await flushPromises()
    expect(state.value).toMatchObject({ presentation: 'page', dockId: 'recording-player-dock' })
    state.value.source = { id: 'unrelated-recap' }
    await flushPromises()
    expect(state.value.presentation).toBe('global')
  } finally {
    wrapper.unmount()
  }
  expect(state.value.dockId).toBe('')
  expect(state.value.presentation).toBe('global')
})
