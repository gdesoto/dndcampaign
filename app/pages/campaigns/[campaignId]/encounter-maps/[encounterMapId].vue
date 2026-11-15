<script setup lang="ts">
import { z } from 'zod'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CampaignEncounterMapRegenerateScope, CampaignEncounterMapRoom, CampaignEncounterMapStatus } from '#shared/types/encounter-map'
import { encounterMapGeneratorConfigSchema, type EncounterMapLinkCreateInput, type EncounterMapPatchActionInput } from '#shared/schemas/encounter-map'
import { getEncounterMapFloorMap, toPlayerSafeMap } from '#shared/utils/encounter-map'
import { createEncounterMapConfig, encounterMapTypes, randomEncounterMapSeed } from '~/utils/encounter-map-options'
import type { EncounterMapMarkerSelection } from '~/utils/encounter-map-features'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const campaignId = computed(() => route.params.campaignId as string)
const encounterMapId = computed(() => route.params.encounterMapId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const encounterMapApi = useEncounterMaps()

// One mutation at a time; the active one drives loading states.
const actionError = ref('')
type EncounterMapMutation = {
  type: 'save-settings' | 'save-name' | 'set-status' | 'regenerate' | 'save-room' | 'patch-map'
    | 'create-link' | 'delete-link' | 'create-snapshot' | 'rename-snapshot' | 'restore-snapshot'
    | 'publish' | 'create-encounter'
  recordId?: string
}
const activeMutation = ref<EncounterMapMutation | null>(null)
const mutationBusy = computed(() => activeMutation.value !== null)
const runMutation = async <T,>(operation: EncounterMapMutation, action: () => Promise<T>, failureMessage: string) => {
  if (!canWriteContent.value || mutationBusy.value) return
  activeMutation.value = operation
  actionError.value = ''
  try {
    return await action()
  } catch (cause) {
    actionError.value = (cause as Error).message || failureMessage
  } finally {
    activeMutation.value = null
  }
}
const notifyFailure = (title: string) => {
  if (actionError.value) toast.add({ title, description: actionError.value, color: 'error' })
}

const {
  data: encounterMap,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `encounter-map-${campaignId.value}-${encounterMapId.value}`,
  () => encounterMapApi.getEncounterMap(campaignId.value, encounterMapId.value),
)
const { data: rooms, refresh: refreshRooms } = await useAsyncData(
  () => `encounter-map-rooms-${campaignId.value}-${encounterMapId.value}`,
  () => encounterMapApi.listRooms(campaignId.value, encounterMapId.value),
)
const { data: links, refresh: refreshLinks } = await useAsyncData(
  () => `encounter-map-links-${campaignId.value}-${encounterMapId.value}`,
  () => encounterMapApi.listLinks(campaignId.value, encounterMapId.value),
)
// Thumbnails need each snapshot's map, so history loads after the page.
const {
  data: snapshots,
  pending: snapshotsPending,
  error: snapshotsError,
  refresh: refreshSnapshots,
} = useLazyAsyncData(
  () => `encounter-map-snapshots-${campaignId.value}-${encounterMapId.value}`,
  () => encounterMapApi.listSnapshots(campaignId.value, encounterMapId.value),
  { server: false },
)

// Generator settings are a draft of the saved seed and config.
const settings = reactive({ seed: '', config: createEncounterMapConfig() })
const settingsSchema = z.object({
  seed: z.string().trim().max(80),
  config: encounterMapGeneratorConfigSchema,
})
const settingsForm = useTemplateRef('settingsForm')
const settingsDraft = useEditorDraft(
  () => ({ seed: settings.seed, config: settings.config }),
  (value) => { settings.seed = value.seed; settings.config = value.config },
)
watch(encounterMap, (value) => {
  if (!value) return
  settingsDraft.sync({ seed: value.seed, config: createEncounterMapConfig(value.config) }, value.id)
}, { immediate: true })
// Room details are a draft of the selected room's saved record.
const roomEditor = reactive({
  name: '',
  description: '',
  gmNotes: '',
  playerNotes: '',
  readAloud: '',
  state: 'UNSEEN' as CampaignEncounterMapRoom['state'],
})
const roomDraft = useEditorDraft(() => ({ ...roomEditor }), value => Object.assign(roomEditor, value))
const { confirmDiscard: confirmRoomDiscard } = useUnsavedChanges(roomDraft.dirty, mutationBusy)
const { confirmDiscard: confirmSettingsDiscard } = useUnsavedChanges(settingsDraft.dirty, mutationBusy)

const activeTab = ref<'generator' | 'room' | 'contents' | 'links' | 'history'>('generator')
const validateSettings = async () => {
  if (settingsSchema.safeParse(settings).success) return true
  activeTab.value = 'generator'
  await nextTick()
  await settingsForm.value?.validate({ silent: true })
  toast.add({ title: 'Check the generator settings', color: 'error' })
  return false
}
const submittedSeed = () => settings.seed.trim() || undefined

const saveSettings = async () => {
  if (!await validateSettings()) return
  const submitted = settingsDraft.snapshot()
  const saved = await runMutation({ type: 'save-settings' }, async () => {
    await encounterMapApi.updateEncounterMap(campaignId.value, encounterMapId.value, {
      seed: submittedSeed(),
      theme: settings.config.theme.trim(),
      config: settings.config,
    })
    settingsDraft.accept(submitted)
    await refresh()
    return true
  }, 'Unable to save generator settings.')
  if (saved) toast.add({ title: 'Generator settings saved', color: 'success' })
  else notifyFailure('Unable to save generator settings')
}

// Room details that a layout rebuild would reset.
const hasRoomDetails = computed(() => (links.value ?? []).some(link => link.roomId)
  || (rooms.value ?? []).some((room) => {
    const geometry = encounterMap.value?.map.rooms.find(item => item.roomNumber === room.roomNumber)
    return Boolean(room.description || room.gmNotes || room.playerNotes || room.readAloud || room.tags.length)
      || room.state !== 'UNSEEN'
      || room.name !== (geometry?.label || `Room ${room.roomNumber}`)
  }))

const rebuildOpen = ref(false)
const rebuildConfirmation = shallowRef<{ title: string; description: string; confirmLabel: string; action: () => Promise<void> } | null>(null)
const confirmMapRebuild = (title: string, description: string, confirmLabel: string, action: () => Promise<boolean | undefined>) => {
  rebuildConfirmation.value = {
    title,
    description,
    confirmLabel,
    action: async () => {
      if (!await action()) throw new Error(actionError.value || 'Unable to rebuild map. Try again.')
    },
  }
  rebuildOpen.value = true
}

const restoreSnapshot = (snapshotId: string) => runMutation({ type: 'restore-snapshot', recordId: snapshotId }, async () => {
  await encounterMapApi.restoreSnapshot(campaignId.value, encounterMapId.value, snapshotId)
  settingsDraft.discard()
  roomDraft.discard()
  await Promise.all([refresh(), refreshRooms(), refreshLinks(), refreshSnapshots()])
  return true
}, 'Unable to restore snapshot.')

const scopeLabels: Record<CampaignEncounterMapRegenerateScope, string> = {
  FULL: 'Map generated', LAYOUT: 'Layout regenerated', DOORS: 'Doors regenerated',
  TRAPS: 'Traps regenerated', ENCOUNTERS: 'Encounters regenerated', TREASURE: 'Treasure regenerated',
}
const offerUndo = (title: string, snapshotId: string) => {
  const targetEncounterMapId = encounterMapId.value
  toast.add({
    title,
    duration: 8000,
    actions: [{
      label: 'Undo',
      onClick: async () => {
        if (targetEncounterMapId !== encounterMapId.value || !await confirmSettingsDiscard() || !await confirmRoomDiscard()) return
        if (!await restoreSnapshot(snapshotId)) notifyFailure('Unable to undo')
      },
    }],
  })
}

const regenerate = async (scope: CampaignEncounterMapRegenerateScope, options: { reroll?: boolean } = {}) => {
  if (!canWriteContent.value || mutationBusy.value || !await confirmRoomDiscard()) return
  const rebuildsLayout = scope === 'FULL' || scope === 'LAYOUT'
  if (rebuildsLayout && !await validateSettings()) return
  if (options.reroll) settings.seed = randomEncounterMapSeed()
  const seed = submittedSeed()
  const action = () => runMutation({ type: 'regenerate' }, async () => {
    const result = await encounterMapApi.regenerateEncounterMap(campaignId.value, encounterMapId.value, {
      scope,
      preserveLocks: true,
      seed,
      ...(rebuildsLayout ? { config: createEncounterMapConfig({ ...settings.config, theme: settings.config.theme.trim() }) } : {}),
    })
    roomDraft.discard()
    await Promise.all([refresh(), refreshRooms(), refreshSnapshots(), ...(rebuildsLayout ? [refreshLinks()] : [])])
    if (result?.previousSnapshotId) offerUndo(scopeLabels[scope], result.previousSnapshotId)
    return true
  }, 'Unable to generate the map.')
  if (rebuildsLayout && hasRoomDetails.value) {
    confirmMapRebuild(
      options.reroll ? 'Reroll this map?' : 'Generate this map again?',
      'This replaces the map and resets saved room details.',
      options.reroll ? 'Reroll map' : 'Generate map',
      action,
    )
  } else if (!await action()) {
    notifyFailure('Unable to generate the map')
  }
}

const generateItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'Regenerate one pass; pinned items stay' }],
  [
    { label: 'Regenerate doors', icon: 'i-lucide-door-open', onSelect: () => regenerate('DOORS') },
    { label: 'Regenerate traps', icon: 'i-lucide-triangle-alert', onSelect: () => regenerate('TRAPS') },
    { label: 'Regenerate encounters', icon: 'i-lucide-swords', onSelect: () => regenerate('ENCOUNTERS') },
    { label: 'Regenerate treasure', icon: 'i-lucide-gem', onSelect: () => regenerate('TREASURE') },
  ],
])

// Name, status, publishing.
const nameOpen = ref(false)
const nameDraft = ref('')
watch(nameOpen, (open) => { if (open) nameDraft.value = encounterMap.value?.name ?? '' })
const saveName = async () => {
  const name = nameDraft.value.trim()
  if (!name) return
  const saved = await runMutation({ type: 'save-name' }, async () => {
    await encounterMapApi.updateEncounterMap(campaignId.value, encounterMapId.value, { name })
    await refresh()
    return true
  }, 'Unable to rename the map.')
  if (saved) nameOpen.value = false
  else notifyFailure('Unable to rename the map')
}
const statusMeta: Record<CampaignEncounterMapStatus, { label: string; color: 'neutral' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Draft', color: 'neutral' },
  READY: { label: 'Ready', color: 'success' },
  ARCHIVED: { label: 'Archived', color: 'warning' },
}
const setStatus = async (status: CampaignEncounterMapStatus, title: string) => {
  const previous = encounterMap.value?.status
  const changed = await runMutation({ type: 'set-status' }, async () => {
    await encounterMapApi.updateEncounterMap(campaignId.value, encounterMapId.value, { status })
    await refresh()
    return true
  }, 'Unable to change the map status.')
  if (!changed) { notifyFailure('Unable to change the map status'); return }
  if (previous && previous !== status) {
    toast.add({ title, actions: [{ label: 'Undo', onClick: () => { void setStatus(previous, 'Status restored') } }] })
  }
}
const publishEncounterMap = async () => {
  const ready = encounterMap.value?.status === 'READY'
  const done = await runMutation({ type: 'publish' }, async () => {
    if (ready) await encounterMapApi.unpublishEncounterMap(campaignId.value, encounterMapId.value)
    else await encounterMapApi.publishEncounterMap(campaignId.value, encounterMapId.value)
    await refresh()
    return true
  }, 'Unable to change publish state.')
  if (!done) notifyFailure('Unable to change publish state')
}
const exportOpen = ref(false)
const moreItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: 'Export…', icon: 'i-lucide-download', onSelect: () => { exportOpen.value = true } }],
  ...(canWriteContent.value ? [[encounterMap.value?.status === 'ARCHIVED'
    ? { label: 'Unarchive', icon: 'i-lucide-archive-restore', onSelect: () => setStatus('DRAFT', 'Map unarchived') }
    : { label: 'Archive', icon: 'i-lucide-archive', onSelect: () => setStatus('ARCHIVED', 'Map archived') }]] : []),
])

// View state: floor, layers, selection.
const showPlayerSafe = ref(false)
const showRoute = ref(false)
const showLabels = ref(true)
const showGrid = ref(true)
const currentFloor = ref(0)
const currentRoomId = ref<string | null>(null)
const selectedMarker = ref<EncounterMapMarkerSelection | null>(null)
const mapCanvas = useTemplateRef('mapCanvas')

const displayedMap = computed(() => {
  if (!encounterMap.value) return null
  return showPlayerSafe.value ? toPlayerSafeMap(encounterMap.value.map) : encounterMap.value.map
})
const floorMap = computed(() => displayedMap.value ? getEncounterMapFloorMap(displayedMap.value, currentFloor.value) : null)
const floorItems = computed(() => Array.from({ length: encounterMap.value?.map.floorCount || 1 }, (_, value) => ({ label: encounterMap.value?.map.floorLabels?.[value] || `Floor ${value + 1}`, value })))
const isForest = computed(() => encounterMap.value?.map.mapType === 'FOREST')
const mapTypeMeta = computed(() => encounterMapTypes.find(item => item.value === (encounterMap.value?.map.mapType || 'DUNGEON')))
const layerItems = computed<DropdownMenuItem[]>(() => [
  { label: 'Labels', type: 'checkbox', checked: showLabels.value, onUpdateChecked: (value: boolean) => { showLabels.value = value }, onSelect: (event: Event) => event.preventDefault() },
  { label: 'Grid', type: 'checkbox', checked: showGrid.value, onUpdateChecked: (value: boolean) => { showGrid.value = value }, onSelect: (event: Event) => event.preventDefault() },
  {
    label: 'Encounter route', type: 'checkbox', checked: showRoute.value && !showPlayerSafe.value,
    disabled: !encounterMap.value?.map.flow || showPlayerSafe.value,
    onUpdateChecked: (value: boolean) => { showRoute.value = value }, onSelect: (event: Event) => event.preventDefault(),
  },
  { type: 'separator' },
  { label: 'Player view', icon: 'i-lucide-eye', type: 'checkbox', checked: showPlayerSafe.value, onUpdateChecked: (value: boolean) => { showPlayerSafe.value = value }, onSelect: (event: Event) => event.preventDefault() },
])

let initializedMapId = ''
watch(encounterMap, (value) => {
  if (!value || (value.id === initializedMapId && currentFloor.value < (value.map.floorCount || 1))) return
  const entrance = value.map.rooms.find(room => room.id === value.map.flow?.entryRoomId)
  const groundFloor = value.map.floorLabels?.indexOf('Ground floor') ?? -1
  currentFloor.value = entrance ? entrance.floor || 0 : groundFloor >= 0 ? groundFloor : 0
  initializedMapId = value.id
  currentRoomId.value = null
  selectedMarker.value = null
}, { immediate: true })
// Clear a marker selection whose item left the visible floor.
watch(floorMap, (map) => {
  const id = selectedMarker.value?.id
  if (!id || !map) return
  const items = [...map.doors, ...map.traps, ...map.encounters, ...map.treasures]
  if (!items.some(item => item.id === id)) selectedMarker.value = null
})

const selectedRoom = computed(() => floorMap.value?.rooms.find(room => room.id === currentRoomId.value) ?? null)
const selectedRoomMeta = computed(() => selectedRoom.value
  ? rooms.value?.find(room => room.roomNumber === selectedRoom.value?.roomNumber) ?? null
  : null)
const selectedRoomTerrain = computed(() => {
  const room = selectedRoom.value
  if (!room) return []
  return (floorMap.value?.terrain || [])
    .filter(feature => feature.roomId ? feature.roomId === room.id : feature.x < room.x + room.width
      && feature.x + feature.width > room.x && feature.y < room.y + room.height && feature.y + feature.height > room.y)
    .map(feature => ({
      id: feature.id,
      label: feature.label || feature.kind.charAt(0) + feature.kind.slice(1).toLowerCase(),
      effects: [
        feature.elevationFeet !== undefined ? `+${feature.elevationFeet} ft` : '',
        feature.blocksMovement ? 'Blocks movement' : '',
        feature.blocksSight ? 'Blocks sight' : '',
        feature.kind === 'DIFFICULT' ? 'Extra movement cost' : '',
        feature.kind === 'HAZARD' ? 'Environmental hazard' : '',
      ].filter(Boolean).join(' · '),
    }))
})

const roomStates = [
  { label: 'Unseen', value: 'UNSEEN' as const },
  { label: 'Explored', value: 'EXPLORED' as const },
  { label: 'Cleared', value: 'CLEARED' as const },
  { label: 'Contested', value: 'CONTESTED' as const },
]
const geometry = reactive({ x: 0, y: 0, width: 2, height: 2 })
watch(selectedRoomMeta, (value) => {
  // A transient refresh must not erase a room draft when the selected room is absent.
  if (!value && roomDraft.dirty.value) return
  roomDraft.sync({
    name: value?.name || '', description: value?.description || '', gmNotes: value?.gmNotes || '',
    playerNotes: value?.playerNotes || '', readAloud: value?.readAloud || '', state: value?.state || 'UNSEEN',
  }, value?.id || '')
}, { immediate: true })
watch(selectedRoom, (room) => {
  if (room) Object.assign(geometry, { x: room.x, y: room.y, width: room.width, height: room.height })
}, { immediate: true })

const selectRoom = async (id: string | null) => {
  const room = id ? displayedMap.value?.rooms.find(item => item.id === id) : null
  if (mutationBusy.value || (id && !room)) return false
  if (id === currentRoomId.value && (!room || (room.floor || 0) === currentFloor.value)) return true
  if (!await confirmRoomDiscard()) return false
  roomDraft.discard()
  if (room && (room.floor || 0) !== currentFloor.value) {
    currentFloor.value = room.floor || 0
    selectedMarker.value = null
  }
  currentRoomId.value = id
  return true
}
const inspectRoom = async (id: string | null) => {
  if (await selectRoom(id) && id) activeTab.value = 'room'
}
const selectedRoomModel = computed({
  get: () => currentRoomId.value,
  set: (id: string | null) => { void inspectRoom(id) },
})
const inspectMarker = (selection: EncounterMapMarkerSelection | null) => {
  selectedMarker.value = selection
  if (selection) activeTab.value = 'contents'
}
const selectFloor = async (floor: number) => {
  if (floor === currentFloor.value || mutationBusy.value || !await confirmRoomDiscard()) return
  roomDraft.discard()
  currentRoomId.value = null
  selectedMarker.value = null
  currentFloor.value = floor
}
const selectedFloor = computed({
  get: () => currentFloor.value,
  set: (floor: string | number) => { void selectFloor(Number(floor)) },
})

const patchMap = async (actions: EncounterMapPatchActionInput[]) => {
  const patched = await runMutation({ type: 'patch-map' }, async () => {
    await encounterMapApi.patchMap(campaignId.value, encounterMapId.value, { actions })
    await Promise.all([refresh(), refreshRooms()])
    return true
  }, 'Unable to update the map.')
  if (!patched) notifyFailure('Unable to update the map')
  return patched
}
const geometryChanged = computed(() => Boolean(selectedRoom.value) && (
  geometry.x !== selectedRoom.value!.x || geometry.y !== selectedRoom.value!.y
  || geometry.width !== selectedRoom.value!.width || geometry.height !== selectedRoom.value!.height))
const applyGeometry = async () => {
  const room = selectedRoom.value
  if (!room || !geometryChanged.value) return
  const actions: EncounterMapPatchActionInput[] = []
  if (geometry.x !== room.x || geometry.y !== room.y) actions.push({ type: 'MOVE_ROOM', roomId: room.id, x: geometry.x, y: geometry.y })
  if (geometry.width !== room.width || geometry.height !== room.height) actions.push({ type: 'RESIZE_ROOM', roomId: room.id, width: geometry.width, height: geometry.height })
  await patchMap(actions)
}
const paintZone = async (type: 'SAFE' | 'HAZARD') => {
  const room = selectedRoom.value
  if (!room) return
  const cells = []
  for (let x = room.x; x < room.x + room.width; x += 1) {
    for (let y = room.y; y < room.y + room.height; y += 1) cells.push({ x, y })
  }
  await patchMap([{ type: 'PAINT_ZONE', zoneType: type, label: `${type === 'SAFE' ? 'Safe' : 'Hazard'} zone`, cells, floor: currentFloor.value }])
}
const removeSelectedRoom = async () => {
  const room = selectedRoom.value
  if (!room) return
  const removed = await runMutation({ type: 'patch-map' }, async () => {
    await encounterMapApi.patchMap(campaignId.value, encounterMapId.value, { actions: [{ type: 'REMOVE_ROOM', roomId: room.id }] })
    await Promise.all([refresh(), refreshRooms()])
    return true
  }, 'Unable to remove the room.')
  if (!removed) throw new Error(actionError.value)
  roomDraft.discard()
  currentRoomId.value = null
}

const saveRoomMetadata = async () => {
  if (!selectedRoomMeta.value) return
  const roomId = selectedRoomMeta.value.id
  const submitted = roomDraft.snapshot()
  const saved = await runMutation({ type: 'save-room' }, async () => {
    await encounterMapApi.updateRoom(campaignId.value, encounterMapId.value, roomId, {
      name: roomEditor.name,
      description: roomEditor.description || null,
      gmNotes: roomEditor.gmNotes || null,
      playerNotes: roomEditor.playerNotes || null,
      readAloud: roomEditor.readAloud || null,
      state: roomEditor.state,
    })
    roomDraft.accept(submitted)
    await refreshRooms()
    return true
  }, 'Unable to save room details.')
  if (saved) toast.add({ title: 'Room details saved', color: 'success' })
  else notifyFailure('Unable to save room details')
}
const createEncounterFromRoom = async () => {
  if (!selectedRoomMeta.value) return
  const roomId = selectedRoomMeta.value.id
  const encounterId = await runMutation({ type: 'create-encounter' }, async () => {
    const result = await encounterMapApi.createEncounterFromRoom(campaignId.value, encounterMapId.value, roomId)
    if (!result) throw new Error('Encounter creation returned an empty response.')
    await refreshLinks()
    return result.encounterId
  }, 'Unable to create an encounter from this room.')
  if (encounterId) await navigateTo(`/campaigns/${campaignId.value}/encounters/${encounterId}`)
  else notifyFailure('Unable to create encounter')
}

// Links and snapshots.
const createLink = async (input: EncounterMapLinkCreateInput) => {
  const created = await runMutation({ type: 'create-link' }, async () => {
    await encounterMapApi.createLink(campaignId.value, encounterMapId.value, input)
    await refreshLinks()
    return true
  }, 'Unable to add the link.')
  if (!created) notifyFailure('Unable to add the link')
}
const deleteLink = async (linkId: string) => {
  const deleted = await runMutation({ type: 'delete-link', recordId: linkId }, async () => {
    await encounterMapApi.deleteLink(campaignId.value, encounterMapId.value, linkId)
    await refreshLinks()
    return true
  }, 'Unable to remove the link.')
  if (!deleted) notifyFailure('Unable to remove the link')
}
const createSnapshot = async (label?: string) => {
  const created = await runMutation({ type: 'create-snapshot' }, async () => {
    await encounterMapApi.createSnapshot(campaignId.value, encounterMapId.value, { snapshotType: 'MANUAL', label })
    await refreshSnapshots()
    return true
  }, 'Unable to save a snapshot.')
  if (created) toast.add({ title: 'Snapshot saved', color: 'success' })
  else notifyFailure('Unable to save a snapshot')
}
const renameSnapshot = async (snapshotId: string, label: string | null) => {
  const renamed = await runMutation({ type: 'rename-snapshot', recordId: snapshotId }, async () => {
    await encounterMapApi.updateSnapshot(campaignId.value, encounterMapId.value, snapshotId, { label })
    await refreshSnapshots()
    return true
  }, 'Unable to rename the snapshot.')
  if (!renamed) notifyFailure('Unable to rename the snapshot')
}
const confirmRestore = async (snapshotId: string) => {
  if (!canWriteContent.value || mutationBusy.value) return
  if (!await confirmSettingsDiscard() || !await confirmRoomDiscard()) return
  confirmMapRebuild(
    'Restore this snapshot?',
    'This replaces the current map and its generator settings.',
    'Restore snapshot',
    () => restoreSnapshot(snapshotId),
  )
}

const copySeed = async () => {
  if (!encounterMap.value) return
  try {
    await navigator.clipboard.writeText(encounterMap.value.seed)
    toast.add({ title: 'Seed copied', color: 'success' })
  } catch {
    toast.add({ title: 'Unable to copy the seed', color: 'error' })
  }
}

const tabs = computed(() => [
  { label: 'Generator', value: 'generator' as const },
  { label: isForest.value ? 'Clearing' : 'Room', value: 'room' as const },
  { label: 'Contents', value: 'contents' as const },
  { label: 'Links', value: 'links' as const },
  { label: 'History', value: 'history' as const },
])
</script>

<template>
  <div class="min-w-0 space-y-4">
    <UPageHeader :ui="{ root: 'py-4' }">
      <template #title>
        <span class="flex flex-wrap items-center gap-2">
          <UIcon v-if="mapTypeMeta" :name="mapTypeMeta.icon" class="size-6 shrink-0 text-muted" aria-hidden="true" />
          <span>{{ encounterMap?.name || 'Encounter map' }}</span>
          <UPopover v-if="encounterMap && canWriteContent" v-model:open="nameOpen">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-pencil" aria-label="Rename map" :disabled="mutationBusy" />
            <template #content>
              <form class="flex w-80 max-w-[calc(100vw-2rem)] gap-2 p-3" @submit.prevent="saveName">
                <UInput v-model="nameDraft" aria-label="Map name" maxlength="200" class="min-w-0 flex-1" autofocus />
                <UButton type="submit" :loading="activeMutation?.type === 'save-name'" :disabled="!nameDraft.trim() || nameDraft.trim() === encounterMap.name">Save</UButton>
              </form>
            </template>
          </UPopover>
          <UBadge v-if="encounterMap" :color="statusMeta[encounterMap.status].color" variant="subtle">{{ statusMeta[encounterMap.status].label }}</UBadge>
        </span>
      </template>
      <template #links>
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" :to="`/campaigns/${campaignId}/encounter-maps`">Back</UButton>
          <template v-if="canWriteContent && encounterMap">
            <UButton color="neutral" variant="outline" icon="i-lucide-dices" :disabled="mutationBusy" @click="regenerate('FULL', { reroll: true })">Reroll</UButton>
            <UFieldGroup>
              <UButton icon="i-lucide-sparkles" :loading="activeMutation?.type === 'regenerate'" :disabled="mutationBusy" @click="regenerate('FULL')">Generate</UButton>
              <UDropdownMenu :items="generateItems" :content="{ align: 'end' }" :disabled="mutationBusy">
                <UButton icon="i-lucide-chevron-down" aria-label="More generate options" :disabled="mutationBusy" />
              </UDropdownMenu>
            </UFieldGroup>
            <UButton
              color="neutral"
              variant="outline"
              :icon="encounterMap.status === 'READY' ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :loading="activeMutation?.type === 'publish'"
              :disabled="mutationBusy"
              @click="publishEncounterMap"
            >
              {{ encounterMap.status === 'READY' ? 'Unpublish' : 'Publish' }}
            </UButton>
          </template>
          <UDropdownMenu v-if="encounterMap" :items="moreItems" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" aria-label="More map actions" />
          </UDropdownMenu>
        </div>
      </template>
    </UPageHeader>

    <SharedReadOnlyAlert v-if="!canWriteContent" description="Your role can view this encounter map but cannot modify it." />

    <USkeleton v-if="pending && !encounterMap" class="h-[min(70dvh,48rem)] w-full" />
    <UCard v-else-if="error && !encounterMap" :ui="{ body: 'p-6' }">
      <p role="alert" class="text-sm text-error">Unable to load encounter map.</p>
      <UButton class="mt-3" color="neutral" variant="outline" @click="() => refresh()">Try again</UButton>
    </UCard>

    <div v-else-if="encounterMap && displayedMap && floorMap" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
      <EncounterMapCanvas
        ref="mapCanvas"
        v-model:selected-room-id="selectedRoomModel"
        :selected-marker="selectedMarker"
        :map="displayedMap"
        :floor="currentFloor"
        :show-labels="showLabels"
        :show-grid="showGrid"
        :show-route="showRoute && !showPlayerSafe"
        @update:selected-marker="inspectMarker"
      >
        <template #toolbar>
          <div class="space-y-2 border-b border-default p-3">
            <div class="flex flex-wrap items-center gap-2">
              <UTabs
                v-if="floorItems.length > 1"
                v-model="selectedFloor"
                :items="floorItems"
                :content="false"
                size="xs"
                aria-label="Viewing floor"
                :disabled="mutationBusy"
              />
              <UBadge v-if="showPlayerSafe" color="info" variant="subtle" icon="i-lucide-eye">Player view</UBadge>
              <div class="ms-auto flex items-center gap-1">
                <UDropdownMenu :items="layerItems" :content="{ align: 'end' }">
                  <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-layers">Layers</UButton>
                </UDropdownMenu>
                <UPopover :content="{ align: 'end' }">
                  <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-map-pinned">Legend</UButton>
                  <template #content>
                    <EncounterMapLegend :map="displayedMap" :floor="currentFloor" :show-route="showRoute && !showPlayerSafe" />
                  </template>
                </UPopover>
                <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-locate-fixed" aria-label="Fit map" @click="mapCanvas?.fit()">Fit</UButton>
              </div>
            </div>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span class="tabular-nums">{{ encounterMap.map.width }} × {{ encounterMap.map.height }}</span>
              <span>{{ floorMap.rooms.length }} {{ isForest ? 'clearings' : 'rooms' }}</span>
              <span>{{ floorMap.corridors.length }} {{ isForest ? 'trails' : 'passages' }}</span>
              <span>{{ floorMap.encounters.length }} encounters</span>
              <time :datetime="encounterMap.map.metadata.generatedAt" class="tabular-nums">Generated {{ new Date(encounterMap.map.metadata.generatedAt).toLocaleString() }}</time>
              <span class="flex items-center gap-1">
                Seed <code class="font-mono text-default">{{ encounterMap.seed }}</code>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" aria-label="Copy seed" @click="copySeed" />
              </span>
            </p>
            <EncounterMapRoute
              v-if="encounterMap.map.flow && !showPlayerSafe"
              :map="encounterMap.map"
              :rooms="rooms || []"
              :selected-room-id="currentRoomId"
              :busy="mutationBusy"
              @select-room="inspectRoom"
            />
          </div>
        </template>
      </EncounterMapCanvas>

      <UCard :ui="{ body: 'p-3 sm:p-4' }" class="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <UTabs v-model="activeTab" :items="tabs" :content="false" size="xs" :ui="{ trigger: 'grow px-1', label: 'overflow-visible' }">
          <template #trailing="{ item }">
            <span v-if="item.value === 'generator' && settingsDraft.dirty.value" class="size-1.5 rounded-full bg-warning">
              <span class="sr-only">Unsaved settings</span>
            </span>
          </template>
        </UTabs>

        <div class="mt-4">
          <UForm
            v-if="activeTab === 'generator'"
            ref="settingsForm"
            :schema="settingsSchema"
            :state="settings"
            :disabled="mutationBusy || !canWriteContent"
            class="space-y-3"
            @submit="saveSettings"
          >
            <div v-if="settingsDraft.dirty.value && canWriteContent" class="flex flex-wrap items-center gap-2 rounded-md bg-elevated px-3 py-2">
              <p class="min-w-0 flex-1 text-sm">Unsaved settings</p>
              <UButton size="xs" color="neutral" variant="ghost" @click="settingsDraft.discard()">Discard</UButton>
              <UButton size="xs" color="neutral" variant="outline" type="submit" :loading="activeMutation?.type === 'save-settings'">Save settings</UButton>
            </div>
            <EncounterMapGeneratorOptions
              v-model="settings.config"
              v-model:seed="settings.seed"
              :disabled="mutationBusy || !canWriteContent"
              :seed-placeholder="encounterMap.seed"
            />
          </UForm>

          <template v-else-if="activeTab === 'room'">
            <p v-if="!selectedRoom" class="py-6 text-center text-sm text-muted">
              Select a {{ isForest ? 'clearing' : 'room' }} on the map or in Contents.
            </p>
            <div v-else class="space-y-4">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="type-record min-w-0 flex-1 truncate">
                    <span class="font-mono text-muted">{{ selectedRoom.roomNumber }}</span>
                    {{ selectedRoomMeta?.name || selectedRoom.label || `${isForest ? 'Clearing' : 'Room'} ${selectedRoom.roomNumber}` }}
                  </h2>
                  <UBadge v-if="selectedRoom.isSecret" color="warning" variant="subtle">Secret</UBadge>
                </div>
                <dl class="grid grid-cols-2 gap-2 text-xs">
                  <div><dt class="text-muted">Position</dt><dd class="tabular-nums">{{ selectedRoom.x }}, {{ selectedRoom.y }}</dd></div>
                  <div><dt class="text-muted">Size</dt><dd class="tabular-nums">{{ selectedRoom.width }} × {{ selectedRoom.height }}</dd></div>
                </dl>
                <section v-if="selectedRoomTerrain.length" aria-label="Room terrain" class="rounded-md bg-elevated p-3">
                  <h3 class="type-label">Terrain</h3>
                  <dl class="mt-2 space-y-1.5 text-xs">
                    <div v-for="feature in selectedRoomTerrain" :key="feature.id">
                      <dt class="font-medium">{{ feature.label }}</dt>
                      <dd v-if="feature.effects" class="text-muted">{{ feature.effects }}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <form v-if="selectedRoomMeta" class="space-y-3" @submit.prevent="saveRoomMetadata">
                <fieldset :disabled="mutationBusy || !canWriteContent" class="space-y-3">
                  <div class="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
                    <UFormField label="Name">
                      <UInput v-model="roomEditor.name" class="w-full" />
                    </UFormField>
                    <UFormField label="State">
                      <USelect v-model="roomEditor.state" :items="roomStates" aria-label="Room state" class="w-full" />
                    </UFormField>
                  </div>
                  <UFormField label="Description">
                    <UTextarea v-model="roomEditor.description" :rows="3" autoresize class="w-full" />
                  </UFormField>
                  <UFormField label="Read-aloud">
                    <UTextarea v-model="roomEditor.readAloud" :rows="2" autoresize class="w-full" />
                  </UFormField>
                  <UFormField label="GM notes">
                    <UTextarea v-model="roomEditor.gmNotes" :rows="2" autoresize class="w-full" />
                  </UFormField>
                  <UFormField label="Player notes">
                    <UTextarea v-model="roomEditor.playerNotes" :rows="2" autoresize class="w-full" />
                  </UFormField>
                </fieldset>
                <div v-if="canWriteContent" class="flex flex-wrap gap-2">
                  <UButton type="submit" :loading="activeMutation?.type === 'save-room'" :disabled="mutationBusy || !roomDraft.dirty.value">Save details</UButton>
                  <UButton color="neutral" variant="outline" icon="i-lucide-swords" :loading="activeMutation?.type === 'create-encounter'" :disabled="mutationBusy" @click="createEncounterFromRoom">
                    Create encounter
                  </UButton>
                </div>
              </form>

              <UCollapsible v-if="canWriteContent" class="border-t border-default pt-3">
                <UButton color="neutral" variant="ghost" size="sm" trailing-icon="i-lucide-chevron-down" class="w-full justify-between">
                  Adjust {{ isForest ? 'clearing' : 'room' }}
                </UButton>
                <template #content>
                  <div class="space-y-3 pt-3">
                    <div class="grid grid-cols-2 gap-2">
                      <UFormField label="X"><UInputNumber v-model="geometry.x" :min="0" :disabled="mutationBusy" class="w-full" /></UFormField>
                      <UFormField label="Y"><UInputNumber v-model="geometry.y" :min="0" :disabled="mutationBusy" class="w-full" /></UFormField>
                      <UFormField label="Width"><UInputNumber v-model="geometry.width" :min="2" :max="80" :disabled="mutationBusy" class="w-full" /></UFormField>
                      <UFormField label="Height"><UInputNumber v-model="geometry.height" :min="2" :max="80" :disabled="mutationBusy" class="w-full" /></UFormField>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <UButton size="sm" color="neutral" variant="outline" :disabled="mutationBusy || !geometryChanged" :loading="activeMutation?.type === 'patch-map'" @click="applyGeometry">
                        Apply position and size
                      </UButton>
                      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-shield-check" :disabled="mutationBusy" @click="paintZone('SAFE')">Mark safe zone</UButton>
                      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-flame" :disabled="mutationBusy" @click="paintZone('HAZARD')">Mark hazard zone</UButton>
                      <SharedConfirmActionPopover
                        :message="`Remove ${selectedRoomMeta?.name || 'this room'}? Its passages, contents, and saved details are deleted.`"
                        trigger-label="Remove room"
                        trigger-icon="i-lucide-trash-2"
                        trigger-size="sm"
                        confirm-label="Remove"
                        :disabled="mutationBusy"
                        :action="removeSelectedRoom"
                      />
                    </div>
                  </div>
                </template>
              </UCollapsible>
            </div>
          </template>

          <EncounterMapContentsPanel
            v-else-if="activeTab === 'contents'"
            :floor-map="floorMap"
            :floor="currentFloor"
            :rooms="rooms || []"
            :selected-room-id="currentRoomId"
            :selected-marker="selectedMarker"
            :busy="mutationBusy"
            :can-write="canWriteContent"
            @select-room="inspectRoom"
            @select-marker="selectedMarker = $event"
            @patch="patchMap"
          />

          <EncounterMapLinksPanel
            v-else-if="activeTab === 'links'"
            :campaign-id="campaignId"
            :links="links || []"
            :rooms="rooms || []"
            :floor-map="floorMap"
            :selected-room-meta-id="selectedRoomMeta?.id"
            :busy="mutationBusy"
            :can-write="canWriteContent"
            :creating="activeMutation?.type === 'create-link'"
            :deleting-id="activeMutation?.type === 'delete-link' ? activeMutation.recordId : undefined"
            @create="createLink"
            @delete="deleteLink"
          />

          <EncounterMapSnapshotHistory
            v-else
            :snapshots="snapshots"
            :pending="snapshotsPending"
            :error="snapshotsError"
            :busy="mutationBusy"
            :can-write="canWriteContent"
            :creating="activeMutation?.type === 'create-snapshot'"
            :restoring-id="activeMutation?.type === 'restore-snapshot' ? activeMutation.recordId : undefined"
            @retry="refreshSnapshots"
            @create="createSnapshot"
            @rename="renameSnapshot"
            @restore="confirmRestore"
          />
        </div>
      </UCard>
    </div>

    <EncounterMapExportModal
      v-if="encounterMap"
      v-model:open="exportOpen"
      :campaign-id="campaignId"
      :encounter-map-id="encounterMapId"
      :floor="currentFloor"
      :floor-label="floorItems[currentFloor]?.label"
      :floor-count="floorItems.length"
    />
    <SharedConfirmActionModal
      v-if="rebuildConfirmation"
      v-model:open="rebuildOpen"
      :title="rebuildConfirmation.title"
      :description="rebuildConfirmation.description"
      :confirm-label="rebuildConfirmation.confirmLabel"
      :action="rebuildConfirmation.action"
    >
      <template #content>
        <ul class="list-disc space-y-2 pl-5 text-sm">
          <li>Saved room names, descriptions, notes, read-aloud text, tags, and explored states are reset when the room layout changes.</li>
          <li>Room links lose their room associations and become whole-map links.</li>
        </ul>
        <p class="text-sm text-muted">The previous map is kept in History, but snapshots do not restore saved room details or room-link associations.</p>
      </template>
    </SharedConfirmActionModal>
  </div>
</template>
