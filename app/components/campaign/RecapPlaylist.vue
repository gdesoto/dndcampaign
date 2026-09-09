<script setup lang="ts">
import { readRecapProgress } from '~/utils/recap-progress'
import { formatSessionDate } from '~/utils/session-date'
import type { RecordAction } from '~/types/actions'
import { recapWatchLink } from '~/utils/recap-links'

type RecapItem = {
  id: string
  filename: string
  mimeType?: string
  createdAt: string
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

const props = withDefaults(defineProps<{
  campaignId?: string
  watchBasePath?: string
  recaps: RecapItem[] | null | undefined
  selectedRecapId: string
  playbackUrl: string
  loading: boolean
  deleting: boolean
  error: string
  deleteError: string
  canDelete?: boolean
  deleteAction?: (recapId: string) => Promise<unknown>
  title?: string
  description?: string
  emptyMessage?: string
  emptyActionLabel?: string
  emptyActionTo?: string
}>(), {
  campaignId: '',
  watchBasePath: '',
  canDelete: false,
  deleteAction: undefined,
  title: '',
  description: '',
  emptyMessage: '',
  emptyActionLabel: '',
  emptyActionTo: '',
})

const emit = defineEmits<{
  play: [recapId: string]
  delete: [recapId: string]
  select: [recapId: string]
  'open-player': []
}>()
const mounted = ref(false)
const savedPosition = computed(() => mounted.value
  ? readRecapProgress(props.selectedRecapId)?.position || 0
  : 0)
onMounted(() => { mounted.value = true })
watch([mounted, () => props.recaps], ([ready, recaps]) => {
  if (!ready || !recaps?.length) return
  const latest = recaps.map(recap => ({ id: recap.id, progress: readRecapProgress(recap.id) }))
    .filter(item => item.progress)
    .sort((a, b) => b.progress!.updatedAt - a.progress!.updatedAt)[0]
  if (latest) emit('select', latest.id)
}, { immediate: true })
const toast = useToast()
const recapActions = (recap: RecapItem): RecordAction[] => {
  const base = props.watchBasePath || (props.campaignId ? `/campaigns/${props.campaignId}` : '')
  return [
    ...(base ? [
      { label: 'Open playlist', icon: 'i-lucide-list-video', to: recapWatchLink(base, recap.id) },
      { label: 'Copy link', icon: 'i-lucide-link', action: async () => {
        await navigator.clipboard.writeText(new URL(recapWatchLink(base, recap.id), window.location.origin).href)
        toast.add({ title: 'Recap link copied', color: 'success' })
      } },
    ] : []),
    ...(props.canDelete && props.deleteAction ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => props.deleteAction!(recap.id), confirmation: { message: `Delete the ${recap.mimeType?.startsWith('video/') ? 'video' : 'audio'} recap for ${recap.session.title}? Its file will be permanently removed.`, label: 'Delete recap' } }] : []),
  ]
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="type-section">{{ title || 'Recap playlist' }}</h2>
        <UButton v-if="watchBasePath || campaignId" :to="`${watchBasePath || `/campaigns/${campaignId}`}/watch`" icon="i-lucide-list-video" color="neutral" variant="ghost">Open playlist</UButton>
      </div>
      <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
    </template>
    <div class="space-y-4">
      <ul v-if="recaps?.length" class="divide-y divide-muted">
        <li v-for="recap in recaps" :key="recap.id" class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div class="min-w-0 flex-1 basis-48">
            <NuxtLink v-if="watchBasePath || campaignId" :to="recapWatchLink(watchBasePath || `/campaigns/${campaignId}`, recap.id)" class="type-record break-words hover:underline">{{ recap.session.title }}</NuxtLink>
            <p v-else class="type-record">{{ recap.session.title }}</p>
            <p class="mt-1 text-xs tabular-nums text-muted">Session {{ recap.session.sessionNumber ?? '—' }} · {{ formatSessionDate(recap.session.playedAt) }} · {{ recap.mimeType?.startsWith('video/') ? 'Video' : 'Audio' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-play" :aria-label="`Play ${recap.session.title}`" :disabled="loading || deleting" :loading="loading && recap.id === selectedRecapId" @click="emit('play', recap.id)">Play</UButton>
            <SharedActionMenu :name="`${recap.session.title} recap`" :items="recapActions(recap)" :disabled="loading || deleting" />
          </div>
        </li>
      </ul>
      <div v-else class="space-y-3">
        <p class="text-sm text-muted">{{ emptyMessage || 'No recaps yet. Upload a recap on a session to build the playlist.' }}</p>
        <UButton v-if="emptyActionTo" variant="outline" :to="emptyActionTo">{{ emptyActionLabel || 'Upload a recap' }}</UButton>
      </div>
      <div v-if="recaps?.length && (playbackUrl || savedPosition > 0)" class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-3">
        <p class="text-sm text-muted">{{ recaps.find(item => item.id === selectedRecapId)?.session.title }}</p>
        <UButton v-if="playbackUrl" size="sm" variant="ghost" @click="emit('open-player')">Open player</UButton>
        <UButton v-else size="sm" variant="outline" :loading="loading" :disabled="deleting" @click="emit('play', selectedRecapId)">Resume at {{ Math.floor(savedPosition / 60) }}:{{ Math.floor(savedPosition % 60).toString().padStart(2, '0') }}</UButton>
      </div>
      <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
      <p v-if="deleteError" role="alert" class="text-sm text-error">{{ deleteError }}</p>
    </div>
  </UCard>
</template>
