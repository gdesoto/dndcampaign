<script setup lang="ts">
import type { WatchRecap } from '~/composables/useRecapWatch'
import { formatSessionDate } from '~/utils/session-date'

const props = defineProps<{
  recaps: WatchRecap[] | null | undefined
  basePath: string
  resolvePlayback: (id: string) => Promise<{ url: string } | null>
}>()
const { player, playlist, selected, selectedId, selectedIndex, next, previous, loading, error, autoAdvance, choose, select } = useRecapWatch({
  recaps: toRef(props, 'recaps'),
  resolvePlayback: id => props.resolvePlayback(id),
})
const state = player.state
const active = computed(() => Boolean(selected.value) && state.value.source?.recapProgressId === selectedId.value)
const playlistButtons = new Map<string, HTMLButtonElement>()

const setPlaylistButton = (id: string, element: unknown) => {
  if (element instanceof HTMLButtonElement) playlistButtons.set(id, element)
  else if (!element) playlistButtons.delete(id)
}

watch([selectedId, playlist], async ([id]) => {
  if (!id) return
  await nextTick()
  playlistButtons.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}, { flush: 'post' })
</script>

<template>
  <div v-if="playlist.length" class="@container">
    <div class="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section class="min-w-0 space-y-4" aria-label="Recap player">
        <div class="overflow-hidden rounded-xl border border-default bg-elevated">
          <div v-if="!active || !selected?.mimeType?.startsWith('video/')" class="flex aspect-video flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/15 to-elevated p-6 text-center">
            <UIcon :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-headphones'" class="size-14 text-primary" :class="loading ? 'animate-spin' : ''" />
            <p class="font-display text-2xl text-highlighted">{{ selected?.session.title || 'Choose a recap' }}</p>
            <p class="text-sm text-muted">{{ loading ? 'Loading recap…' : 'Session recap' }}</p>
            <UButton v-if="active" :icon="state.isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" :disabled="loading" @click="player.toggle">
              {{ state.isPlaying ? 'Pause' : 'Play recap' }}
            </UButton>
          </div>
          <MediaPlayerDock dock-id="recap-watch-dock" class="p-3 [&_video]:aspect-video [&_video]:max-h-[70vh] [&_video]:object-contain" :class="!active ? 'hidden' : ''" />
        </div>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-2xl text-highlighted">{{ selected?.session.title || (error ? 'Recap unavailable' : 'Choose a recap') }}</h2>
            <p v-if="selected" class="mt-1 text-sm text-muted">Session {{ selected.session.sessionNumber ?? '-' }} · {{ formatSessionDate(selected.session.playedAt) }}</p>
          </div>
          <CampaignRecapLinks v-if="selected" :base-path="basePath" :recap-id="selected.id" hide-open />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton icon="i-lucide-skip-back" variant="outline" :disabled="!previous || loading" @click="() => { if (previous) void choose(previous.id) }">Previous</UButton>
          <UButton icon="i-lucide-skip-forward" variant="outline" :disabled="!next || loading" @click="() => { if (next) void choose(next.id) }">Next</UButton>
          <USwitch v-model="autoAdvance" label="Play next automatically" />
        </div>
        <div v-if="error" role="alert" class="space-y-2 text-sm text-error">
          <p>{{ error }}</p>
          <UButton v-if="selected" variant="outline" @click="() => select(selectedId)">Try again</UButton>
        </div>
        <p v-if="active && state.error" role="alert" class="text-sm text-error">{{ state.error }} Press Play to continue.</p>
        <p class="text-xs text-muted">{{ basePath.startsWith('/public/') ? 'Public link — no sign-in required.' : 'Campaign links require campaign access.' }} Your playback position is saved on this browser.</p>
      </section>
      <UCard class="min-w-0">
        <template #header>
          <h2 class="font-semibold text-highlighted">Session recaps</h2>
          <p class="text-xs text-muted">Oldest to newest · {{ selectedIndex + 1 }} / {{ playlist.length }}</p>
        </template>
        <ol class="max-h-[70vh] space-y-2 overflow-y-auto" aria-label="Session recap playlist">
          <li v-for="(recap, index) in playlist" :key="recap.id">
            <button :ref="element => setPlaylistButton(recap.id, element)" type="button" class="flex w-full items-center gap-3 rounded-lg border border-default p-3 text-left transition hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary" :class="recap.id === selectedId ? 'border-primary bg-primary/10' : ''" :aria-current="recap.id === selectedId ? 'true' : undefined" @click="choose(recap.id)">
              <span class="shrink-0 text-xs tabular-nums text-dimmed">{{ index + 1 }}</span>
              <UIcon :name="recap.mimeType?.startsWith('video/') ? 'i-lucide-video' : 'i-lucide-headphones'" class="size-6 shrink-0 text-primary" />
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-highlighted">{{ recap.session.title }}</span>
                <span class="block text-xs text-muted">Session {{ recap.session.sessionNumber ?? '-' }} · {{ recap.mimeType?.startsWith('video/') ? 'Video' : 'Audio' }}</span>
              </span>
            </button>
          </li>
        </ol>
      </UCard>
    </div>
  </div>
  <UCard v-else><p class="text-sm text-muted">No recaps are available in this playlist.</p></UCard>
</template>
