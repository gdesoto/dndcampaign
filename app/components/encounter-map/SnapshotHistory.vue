<script setup lang="ts">
import type { CampaignEncounterMapSnapshot } from '#shared/types/encounter-map'
import { renderEncounterMapSvg } from '#shared/utils/encounter-map-render'
import { encounterMapTypes } from '~/utils/encounter-map-options'

const props = defineProps<{
  snapshots: CampaignEncounterMapSnapshot[] | null | undefined
  pending: boolean
  error: unknown
  busy: boolean
  canWrite: boolean
  creating: boolean
  restoringId?: string
}>()
const emit = defineEmits<{
  retry: []
  create: [label: string | undefined]
  rename: [snapshotId: string, label: string | null]
  restore: [snapshotId: string]
}>()

const typeLabels = { MANUAL: 'Saved snapshot', PRE_REGENERATE: 'Before regenerate', AUTO: 'Automatic snapshot' } as const
const thumbnails = computed(() => new Map((props.snapshots ?? []).filter(snapshot => snapshot.map).map((snapshot) => {
  const map = snapshot.map!
  const floor = map.rooms.find(room => room.id === map.flow?.entryRoomId)?.floor ?? 0
  const svg = renderEncounterMapSvg(map, { floor, includeGrid: false, includeLabels: false })
  return [snapshot.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`]
})))

const newLabel = ref('')
const createOpen = ref(false)
const submitCreate = () => {
  emit('create', newLabel.value.trim() || undefined)
  newLabel.value = ''
  createOpen.value = false
}

const renamingId = ref('')
const renameValue = ref('')
const startRename = (snapshot: CampaignEncounterMapSnapshot) => {
  renamingId.value = snapshot.id
  renameValue.value = snapshot.label ?? ''
}
const submitRename = () => {
  if (!renamingId.value) return
  emit('rename', renamingId.value, renameValue.value.trim() || null)
  renamingId.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-muted">Snapshots keep the layout and settings, not room notes.</p>
      <UPopover v-if="canWrite" v-model:open="createOpen">
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-camera" :loading="creating" :disabled="busy">Save snapshot</UButton>
        <template #content>
          <form class="flex w-72 gap-2 p-3" @submit.prevent="submitCreate">
            <UInput v-model="newLabel" placeholder="Label (optional)" aria-label="Snapshot label" maxlength="80" class="min-w-0 flex-1" autofocus />
            <UButton type="submit">Save</UButton>
          </form>
        </template>
      </UPopover>
    </div>

    <div v-if="pending && !snapshots" class="space-y-2" aria-busy="true">
      <USkeleton v-for="index in 2" :key="index" class="h-20 w-full" />
    </div>
    <div v-else-if="error && !snapshots" role="alert" class="space-y-2 text-sm text-error">
      <p>Unable to load snapshots.</p>
      <UButton size="sm" color="neutral" variant="outline" @click="emit('retry')">Try again</UButton>
    </div>
    <p v-else-if="!snapshots?.length" class="py-4 text-center text-sm text-muted">No snapshots yet.</p>
    <ul v-else class="space-y-2">
      <li v-for="snapshot in snapshots" :key="snapshot.id" class="flex gap-3 rounded-md border border-default p-2">
        <img
          v-if="thumbnails.get(snapshot.id)"
          :src="thumbnails.get(snapshot.id)"
          alt=""
          class="size-16 shrink-0 rounded-sm bg-elevated object-contain"
        >
        <div v-else class="size-16 shrink-0 rounded-sm bg-elevated" />
        <div class="min-w-0 flex-1 space-y-1">
          <form v-if="renamingId === snapshot.id" class="flex gap-1" @submit.prevent="submitRename" @keydown.esc.prevent="renamingId = ''">
            <UInput v-model="renameValue" size="sm" aria-label="Snapshot label" placeholder="Label" maxlength="80" class="min-w-0 flex-1" autofocus />
            <UButton type="submit" size="sm" icon="i-lucide-check" aria-label="Save label" />
            <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Cancel rename" @click="renamingId = ''" />
          </form>
          <p v-else class="truncate text-sm font-medium text-highlighted">{{ snapshot.label || typeLabels[snapshot.snapshotType] }}</p>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <time :datetime="snapshot.createdAt" class="tabular-nums">{{ new Date(snapshot.createdAt).toLocaleString() }}</time>
            <span class="flex items-center gap-1">
              <UIcon :name="encounterMapTypes.find(item => item.value === snapshot.mapType)?.icon || 'i-lucide-castle'" class="size-3.5" aria-hidden="true" />
              {{ snapshot.roomCount }} {{ snapshot.mapType === 'FOREST' ? 'clearings' : 'rooms' }}
            </span>
          </p>
          <p class="truncate font-mono text-xs text-dimmed" :title="snapshot.seed">{{ snapshot.seed }}</p>
        </div>
        <div v-if="canWrite" class="flex shrink-0 flex-col items-end gap-1">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :disabled="busy"
            :loading="restoringId === snapshot.id"
            :aria-label="`Restore ${snapshot.label || typeLabels[snapshot.snapshotType]}`"
            @click="emit('restore', snapshot.id)"
          >
            Restore
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            :aria-label="`Rename ${snapshot.label || typeLabels[snapshot.snapshotType]}`"
            :disabled="busy"
            @click="startRename(snapshot)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
