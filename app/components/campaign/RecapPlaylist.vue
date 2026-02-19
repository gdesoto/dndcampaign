<script setup lang="ts">
type RecapItem = {
  id: string
  filename: string
  createdAt: string
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

withDefaults(defineProps<{
  campaignId?: string
  recaps: RecapItem[] | null | undefined
  selectedRecapId: string
  playbackUrl: string
  loading: boolean
  deleting: boolean
  error: string
  deleteError: string
  canDelete?: boolean
  title?: string
  description?: string
  emptyMessage?: string
  emptyActionLabel?: string
  emptyActionTo?: string
}>(), {
  canDelete: true,
})

const emit = defineEmits<{
  play: [recapId: string]
  delete: [recapId: string]
  select: [recapId: string]
  'open-player': []
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-lg font-semibold">{{ title || 'Recap playlist' }}</h2>
        <p class="text-sm text-muted">{{ description || 'Listen to session recaps across the campaign.' }}</p>
      </div>
    </template>
    <div class="space-y-4">
      <div v-if="recaps?.length" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div class="space-y-3">
          <div
            v-for="recap in recaps"
            :key="recap.id"
            class="flex items-start justify-between gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm transition"
            :class="recap.id === selectedRecapId ? 'bg-primary/10 border-primary/40' : ''"
          >
            <div>
              <p class="font-semibold">{{ recap.session.title }}</p>
              <p class="text-xs text-muted">
                Session {{ recap.session.sessionNumber ?? '-' }}
                - {{ recap.session.playedAt ? new Date(recap.session.playedAt).toLocaleDateString() : 'Unscheduled' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                variant="outline"
                :loading="loading && recap.id === selectedRecapId"
                @click="emit('play', recap.id)"
              >
                Play
              </UButton>
              <UButton
                v-if="canDelete !== false"
                size="xs"
                variant="ghost"
                color="error"
                :loading="deleting"
                @click="emit('delete', recap.id)"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
        <UCard class="text-xs">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Now playing</p>
          <p class="mt-2 text-sm font-semibold">
            {{ recaps.find((item) => item.id === selectedRecapId)?.session.title || 'Pick a recap' }}
          </p>
          <p class="text-xs text-muted">
            {{ recaps.find((item) => item.id === selectedRecapId)?.session.sessionNumber ?? '-' }}
          </p>
          <div class="mt-3">
            <div v-if="playbackUrl" class="flex items-center justify-between gap-3">
              <p class="text-xs text-muted">Playing in the global player.</p>
              <UButton size="xs" variant="ghost" @click="emit('open-player')">Open player</UButton>
            </div>
            <p v-else class="text-xs text-muted">Select a recap to start listening.</p>
          </div>
        </UCard>
      </div>
      <div v-else class="space-y-3">
        <p class="text-sm text-muted">{{ emptyMessage || 'No recaps yet. Upload a recap on a session to build the playlist.' }}</p>
        <UButton
          v-if="emptyActionTo"
          variant="outline"
          :to="emptyActionTo"
        >
          {{ emptyActionLabel || 'Upload a recap' }}
        </UButton>
      </div>
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
      <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>
    </div>
  </UCard>
</template>

