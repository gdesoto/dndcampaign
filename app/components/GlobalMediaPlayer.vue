<script setup lang="ts">
import type { VideoPlayerElement } from '@videojs/html/video'

const player = useMediaPlayer()
const state = player.state

const libraryEl = ref<VideoPlayerElement | null>(null)
const miniPlayer = ref<HTMLElement | null>(null)

// Reserve the mini player's actual height, including wrapped text and errors.
watch(miniPlayer, (el, _previous, onCleanup) => {
  const updateHeight = () => {
    document.documentElement.style.setProperty('--media-player-height', `${el?.getBoundingClientRect().height || 0}px`)
  }
  updateHeight()
  if (!el) return
  const observer = new ResizeObserver(updateHeight)
  observer.observe(el)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })

const isVideo = computed(() => state.value.source?.kind === 'VIDEO')
const hasSource = computed(() => Boolean(state.value.source))
const playbackLabel = computed(() => state.value.error ? 'Retry playback' : state.value.isPlaying ? 'Pause playback' : 'Play media')
const playbackIcon = computed(() => state.value.error ? 'i-lucide-rotate-cw' : state.value.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play')
const showMini = computed(
  () => hasSource.value && state.value.presentation === 'global'
)

const drawerOpen = computed({
  get: () => state.value.drawerOpen && state.value.presentation === 'global',
  set: (value: boolean) => {
    state.value.drawerOpen = value
  },
})

const drawerTargetReady = ref(false)

watch(
  drawerOpen,
  async (value) => {
    if (!value) {
      drawerTargetReady.value = false
      return
    }
    await nextTick()
    drawerTargetReady.value = true
  },
  { immediate: true }
)

const mediaTarget = computed(() => {
  if (state.value.presentation === 'page' && state.value.dockId) {
    return `#${state.value.dockId}`
  }
  if (drawerTargetReady.value) {
    return '#media-player-drawer-target'
  }
  return '#global-media-player-host'
})

watch(libraryEl, (value, _, onCleanup) => {
  if (!value) return
  // The client plugin registers these elements before the app mounts.
  const disconnect = player.connect(value)
  onCleanup(() => { disconnect(); value.destroy() })
}, { flush: 'post' })

onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('--media-player-height')
})

const onEnded = () => {
  if (player.queue.value?.autoAdvance && player.element.value?.ended) void player.moveInQueue(1)
}

useMediaSession(player)
</script>

<template>
  <div class="pointer-events-none">
    <Teleport :to="mediaTarget">
      <video-player v-if="hasSource" ref="libraryEl" keep-alive :content-title="state.source?.title" class="dmvault-player pointer-events-auto">
        <component :is="isVideo ? 'video-neutral-skin' : 'audio-neutral-skin'" class="block w-full">
          <component :is="isVideo ? 'video' : 'audio'" preload="metadata" playsinline @ended="onEnded">
            <track v-if="state.source?.vttUrl" :key="state.source.vttUrl" :src="state.source.vttUrl" kind="subtitles" srclang="en" label="Captions" default>
          </component>
        </component>
        <div v-if="state.error" class="mt-2 flex flex-wrap items-center gap-2">
          <p v-if="!player.controller.value?.store.error" role="alert" class="text-sm text-error">{{ state.error }}</p>
          <UButton variant="outline" icon="i-lucide-rotate-cw" aria-label="Retry playback" :loading="state.autoplay" @click="player.play">Retry playback</UButton>
        </div>
      </video-player>
    </Teleport>
  </div>

  <div v-if="showMini" ref="miniPlayer" class="pointer-events-none fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 sm:px-6 sm:pb-6">
    <UCard class="pointer-events-auto">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="min-w-0 flex-1 basis-48">
          <p class="text-xs uppercase tracking-[0.08em] text-dimmed">{{ state.isPlaying ? 'Now playing' : 'Media player' }}</p>
          <p class="line-clamp-2 break-words font-semibold">{{ state.source?.title }}</p>
          <p v-if="state.source?.subtitle" class="truncate text-xs text-muted">{{ state.source?.subtitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="lg" variant="outline" :aria-label="playbackLabel" :loading="state.autoplay" @click="player.toggle">
            <UIcon :name="playbackIcon" />
          </UButton>
          <UButton size="lg" variant="ghost" class="ml-3" aria-label="Open full player" @click="player.openDrawer">
            <UIcon name="i-lucide-maximize-2" />
          </UButton>
          <UButton size="lg" variant="ghost" aria-label="Close media player" @click="player.stop">
            <UIcon name="i-lucide-x" />
          </UButton>
        </div>
      </div>
      <p v-if="state.error && !drawerOpen" role="alert" class="mt-3 text-sm text-error">{{ state.error }}</p>
      <div v-if="player.queue.value" class="mt-2 flex flex-wrap items-center gap-2">
        <UButton variant="ghost" icon="i-lucide-skip-back" aria-label="Previous recap" :disabled="!player.hasPrevious.value || state.autoplay" @click="player.moveInQueue(-1)" />
        <UButton variant="ghost" icon="i-lucide-skip-forward" aria-label="Next recap" :disabled="!player.hasNext.value || state.autoplay" @click="player.moveInQueue(1)" />
        <USwitch v-model="player.queue.value.autoAdvance" label="Play next automatically" />
      </div>
    </UCard>
  </div>

  <UDrawer
    v-model:open="drawerOpen"
    direction="bottom"
    :modal="false"
    :overlay="false"
    handle
    handle-only
    title="Media player"
    description="Expanded playback controls and timeline."
    inset
  >
    <span />
    <template #content>
      <div class="pointer-events-auto space-y-4 p-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs uppercase tracking-[0.08em] text-dimmed">Player</p>
            <p class="break-words text-lg font-semibold">{{ state.source?.title || 'Media player' }}</p>
            <p v-if="state.source?.subtitle" class="break-words text-xs text-muted">{{ state.source?.subtitle }}</p>
          </div>
          <UButton size="lg" variant="subtle" aria-label="Minimize media player" @click="player.closeDrawer">
            <UIcon name="i-lucide-minimize-2" />
          </UButton>
        </div>

        <div id="media-player-drawer-target" class="space-y-3" />

      </div>
    </template>
  </UDrawer>

</template>
