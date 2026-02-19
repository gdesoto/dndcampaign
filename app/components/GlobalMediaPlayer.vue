<script setup lang="ts">
const player = useMediaPlayer()
const state = player.state

const mediaEl = ref<HTMLMediaElement | null>(null)
const cleanupListeners = ref<(() => void) | null>(null)

const isVideo = computed(() => state.value.source?.kind === 'VIDEO')
const hasSource = computed(() => Boolean(state.value.source))
const showInline = computed(
  () => hasSource.value && state.value.presentation === 'page' && Boolean(state.value.dockId)
)
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

const progress = computed(() => {
  if (!state.value.duration) return 0
  return Math.min(100, Math.max(0, (state.value.currentTime / state.value.duration) * 100))
})

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const totalSeconds = Math.floor(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const attachListeners = (el: HTMLMediaElement) => {
  const pauseOtherMedia = () => {
    const root = globalThis.document
    if (!root) return
    root.querySelectorAll<HTMLMediaElement>('audio,video').forEach((media) => {
      if (media === el) return
      if (!media.paused) {
        media.pause()
      }
    })
  }

  const onTime = () => {
    state.value.currentTime = el.currentTime || 0
  }
  const onDuration = () => {
    state.value.duration = Number.isFinite(el.duration) ? el.duration : 0
  }
  const onPlay = () => {
    state.value.isPlaying = true
    pauseOtherMedia()
  }
  const onPlaying = () => {
    state.value.isPlaying = true
    pauseOtherMedia()
  }
  const onPause = () => {
    state.value.isPlaying = false
  }
  const onSeek = () => {
    state.value.isPlaying = !el.paused
    state.value.currentTime = el.currentTime || 0
  }
  const onEnded = () => {
    state.value.isPlaying = false
  }
  const onVolume = () => {
    state.value.volume = el.volume
  }

  el.addEventListener('timeupdate', onTime)
  el.addEventListener('durationchange', onDuration)
  el.addEventListener('loadedmetadata', onDuration)
  el.addEventListener('play', onPlay)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('pause', onPause)
  el.addEventListener('seeking', onSeek)
  el.addEventListener('seeked', onSeek)
  el.addEventListener('ended', onEnded)
  el.addEventListener('volumechange', onVolume)

  return () => {
    el.removeEventListener('timeupdate', onTime)
    el.removeEventListener('durationchange', onDuration)
    el.removeEventListener('loadedmetadata', onDuration)
    el.removeEventListener('play', onPlay)
    el.removeEventListener('playing', onPlaying)
    el.removeEventListener('pause', onPause)
    el.removeEventListener('seeking', onSeek)
    el.removeEventListener('seeked', onSeek)
    el.removeEventListener('ended', onEnded)
    el.removeEventListener('volumechange', onVolume)
  }
}

watch(
  mediaEl,
  (value) => {
    cleanupListeners.value?.()
    cleanupListeners.value = null
    if (!value) return
    player.setElement(value)
    cleanupListeners.value = attachListeners(value)
  },
  { immediate: true }
)

watch(
  () => state.value.source?.src,
  (value) => {
    if (!value || !mediaEl.value) return
    if (mediaEl.value.src !== value) {
      mediaEl.value.src = value
      mediaEl.value.load()
    }
  }
)

watch(
  () => state.value.volume,
  (value) => {
    if (!mediaEl.value) return
    if (Math.abs(mediaEl.value.volume - value) > 0.01) {
      mediaEl.value.volume = value
    }
  }
)

watch(
  () => state.value.playbackRate,
  (value) => {
    if (!mediaEl.value) return
    if (mediaEl.value.playbackRate !== value) {
      mediaEl.value.playbackRate = value
    }
  }
)

onBeforeUnmount(() => {
  cleanupListeners.value?.()
})

onMounted(() => {
  // noop
})

const onSeek = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (!state.value.duration) return
  const nextTime = (value / 100) * state.value.duration
  player.seek(nextTime)
}

const onVolume = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  player.setVolume(value)
}

const onRateChange = (event: Event) => {
  const value = Number((event.target as HTMLSelectElement).value)
  player.setPlaybackRate(value)
}

const openFullPlayer = () => {
  player.setPresentation('global')
  player.openDrawer()
}
</script>

<template>
  <div class="pointer-events-none">
    <Teleport :to="mediaTarget">
      <div class="pointer-events-auto space-y-3">
        <component
          :is="isVideo ? 'video' : 'audio'"
          ref="mediaEl"
          class="w-full"
          :class="isVideo ? 'rounded-lg' : 'sr-only'"
          preload="metadata"
          :controls="showInline"
        >
          <track
            v-if="isVideo && state.source?.vttUrl"
            kind="subtitles"
            label="Transcript"
            srclang="en"
            :src="state.source?.vttUrl"
            default
          >
        </component>

        <div v-if="showInline" class="space-y-3 rounded-lg border border-default bg-elevated/40 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Now playing</p>
              <p class="font-semibold">{{ state.source?.title }}</p>
              <p v-if="state.source?.subtitle" class="text-xs text-muted">{{ state.source?.subtitle }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton size="sm" variant="outline" @click="player.toggle">
                <UIcon :name="state.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'" />
              </UButton>
              <UButton size="sm" variant="ghost" @click="openFullPlayer">
                Open player
              </UButton>
            </div>
          </div>
          <div class="space-y-2">
            <input
              class="w-full accent-primary"
              type="range"
              min="0"
              max="100"
              step="0.1"
              :value="progress"
              @input="onSeek"
            >
            <div class="flex items-center justify-between text-xs text-dimmed">
              <span>{{ formatTime(state.currentTime) }}</span>
              <span>{{ formatTime(state.duration) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <div v-if="showMini" class="pointer-events-none fixed bottom-0 left-0 right-0 z-40 px-6 pb-6">
    <UCard class="pointer-events-auto">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Now playing</p>
          <p class="font-semibold">{{ state.source?.title }}</p>
          <p v-if="state.source?.subtitle" class="text-xs text-muted">{{ state.source?.subtitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="lg" variant="outline" @click="player.toggle">
            <UIcon :name="state.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'" />
          </UButton>
          <UButton size="lg" variant="ghost" class="ml-3" @click="player.openDrawer">
            <UIcon name="i-lucide-maximize-2" />
          </UButton>
          <UButton size="lg" variant="ghost" @click="player.stop">
            <UIcon name="i-lucide-x" />
          </UButton>
        </div>
      </div>
    </UCard>
  </div>

  <UDrawer
    v-model:open="drawerOpen"
    direction="bottom"
    :modal="false"
    :overlay="false"
    :handle="false"
    title="Media player"
    description="Expanded playback controls and timeline."
    inset
  >
    <span />
    <template #content>
      <div class="pointer-events-auto space-y-4 p-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Player</p>
            <p class="text-lg font-semibold">{{ state.source?.title || 'Media player' }}</p>
            <p v-if="state.source?.subtitle" class="text-xs text-muted">{{ state.source?.subtitle }}</p>
          </div>
          <UButton size="lg" variant="subtle" @click="player.closeDrawer">
            <UIcon name="i-lucide-minimize-2" />
          </UButton>
        </div>

        <div id="media-player-drawer-target" class="space-y-3" />

        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-3">
            <UButton size="sm" variant="outline" @click="player.toggle">
              <UIcon :name="state.isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'" />
            </UButton>
            <div class="flex items-center gap-2 text-xs text-dimmed">
              <span>{{ formatTime(state.currentTime) }}</span>
              <span>/</span>
              <span>{{ formatTime(state.duration) }}</span>
            </div>
          </div>
          <input
            class="w-full accent-primary"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progress"
            @input="onSeek"
          >
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-xs text-dimmed">
              Volume
              <input
                class="accent-primary"
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="state.volume"
                @input="onVolume"
              >
            </label>
            <label class="flex items-center gap-2 text-xs text-dimmed">
              Speed
              <select
                class="rounded-md border border-default bg-default px-2 py-1 text-xs"
                :value="state.playbackRate"
                @change="onRateChange"
              >
                <option :value="0.75">0.75x</option>
                <option :value="1">1x</option>
                <option :value="1.25">1.25x</option>
                <option :value="1.5">1.5x</option>
                <option :value="2">2x</option>
              </select>
            </label>
          </div>
          <p v-if="state.error" class="text-sm text-error">{{ state.error }}</p>
        </div>
      </div>
    </template>
  </UDrawer>

</template>
