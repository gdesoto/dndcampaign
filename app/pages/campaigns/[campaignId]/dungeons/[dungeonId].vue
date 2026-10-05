<script setup lang="ts">
import type { CampaignDungeonLink, CampaignDungeonRegenerateScope, CampaignDungeonRoom } from '#shared/types/dungeon'
import type { DungeonGeneratorConfigInput, DungeonMapPatchActionInput } from '#shared/schemas/dungeon'
import { getDungeonFloorMap, toPlayerSafeMap } from '#shared/utils/dungeon-map'
import { dungeonMapPalette, renderDungeonDoorSymbol } from '#shared/utils/dungeon-render'
import { createEncounterMapConfig, encounterMapTypes } from '~/utils/encounter-map-options'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const dungeonId = computed(() => route.params.dungeonId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const dungeonApi = useDungeonDetail()

const actionError = ref('')
type DungeonMutation = {
  type: 'save-settings' | 'generate' | 'regenerate' | 'save-room' | 'patch-map'
    | 'create-link' | 'delete-link' | 'create-snapshot' | 'restore-snapshot'
    | 'publish' | 'create-encounter'
  recordId?: string
}
const activeMutation = ref<DungeonMutation | null>(null)
const mutationBusy = computed(() => activeMutation.value !== null)
const rebuildOpen = ref(false)
const rebuildConfirmation = shallowRef<{
  title: string
  confirmLabel: string
  action: () => Promise<void>
} | null>(null)
const confirmMapRebuild = (title: string, confirmLabel: string, action: () => Promise<boolean | undefined>) => {
  rebuildConfirmation.value = {
    title,
    confirmLabel,
    action: async () => {
      if (!await action()) throw new Error(actionError.value || 'Unable to rebuild map. Try again.')
    },
  }
  rebuildOpen.value = true
}
const runMutation = async <T,>(operation: DungeonMutation, action: () => Promise<T>, failureMessage: string) => {
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
const isExporting = ref(false)
const currentRoomId = ref<string | null>(null)
const selectedRoomId = computed({
  get: () => currentRoomId.value,
  set: (id: string | null) => { void selectRoom(id) },
})
const selectedDoorId = ref<string | null>(null)
const activeDetailsTab = ref<'rooms' | 'corridors' | 'doors' | 'traps' | 'encounters' | 'treasure' | 'zones'>('rooms')
const showPlayerSafe = ref(false)
const showRoute = ref(false)
const currentFloor = ref(0)
const selectedFloor = computed({
  get: () => currentFloor.value,
  set: (floor: number) => { void selectFloor(floor) },
})

const {
  data: dungeon,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `dungeon-${campaignId.value}-${dungeonId.value}`,
  () => dungeonApi.getDungeon(campaignId.value, dungeonId.value),
)
const {
  data: rooms,
  refresh: refreshRooms,
} = await useAsyncData(
  () => `dungeon-rooms-${campaignId.value}-${dungeonId.value}`,
  () => dungeonApi.listRooms(campaignId.value, dungeonId.value),
)
const {
  data: links,
  refresh: refreshLinks,
} = await useAsyncData(
  () => `dungeon-links-${campaignId.value}-${dungeonId.value}`,
  () => dungeonApi.listLinks(campaignId.value, dungeonId.value),
)
const {
  data: snapshots,
  refresh: refreshSnapshots,
} = await useAsyncData(
  () => `dungeon-snapshots-${campaignId.value}-${dungeonId.value}`,
  () => dungeonApi.listSnapshots(campaignId.value, dungeonId.value),
)

const editState = reactive({
  name: '',
  theme: '',
  seed: '',
  status: 'DRAFT' as 'DRAFT' | 'READY' | 'ARCHIVED',
})

const configDraft = reactive<DungeonGeneratorConfigInput>(createEncounterMapConfig())

const settingsDraft = useEditorDraft(
  () => ({ ...editState, config: configDraft }),
  value => {
    Object.assign(editState, { name: value.name, theme: value.theme, seed: value.seed, status: value.status })
    Object.assign(configDraft, value.config)
  },
)
watch(dungeon, value => {
  if (!value) return
  settingsDraft.sync({
    name: value.name, theme: value.theme, seed: value.seed, status: value.status,
    config: createEncounterMapConfig(value.config),
  }, value.id)
}, { immediate: true })

const saveSettings = async () => {
  if (!canWriteContent.value || mutationBusy.value) return
  const resolvedTheme = editState.theme.trim()
  if (!resolvedTheme) {
    actionError.value = 'Content theme is required.'
    return
  }
  editState.theme = resolvedTheme
  configDraft.theme = resolvedTheme
  const submitted = settingsDraft.snapshot()
  return runMutation({ type: 'save-settings' }, async () => {
    await dungeonApi.updateDungeon(campaignId.value, dungeonId.value, {
      name: editState.name,
      theme: resolvedTheme,
      seed: editState.seed,
      status: editState.status,
      config: {
        ...configDraft,
        theme: resolvedTheme,
      },
    })
    settingsDraft.accept(submitted)
    await refresh()
  }, 'Unable to save dungeon settings.')
}

const generate = async () => {
  if (!canWriteContent.value || mutationBusy.value || !await confirmRoomDiscard()) return
  const resolvedTheme = editState.theme.trim()
  if (!resolvedTheme) {
    actionError.value = 'Content theme is required.'
    return
  }
  confirmMapRebuild('Generate this map again?', 'Generate map', () => runMutation({ type: 'generate' }, async () => {
    editState.theme = resolvedTheme
    configDraft.theme = resolvedTheme
    await dungeonApi.generateDungeon(campaignId.value, dungeonId.value, {
      seed: editState.seed,
      config: {
        ...configDraft,
        theme: resolvedTheme,
      },
    })
    roomDraft.discard()
    await Promise.all([refresh(), refreshRooms(), refreshLinks()])
    return true
  }, 'Unable to generate dungeon map.'))
}

const regenerate = async (scope: CampaignDungeonRegenerateScope) => {
  if (!canWriteContent.value || mutationBusy.value || !await confirmRoomDiscard()) return
  const applyDraft = scope === 'FULL' || scope === 'LAYOUT'
  const resolvedTheme = editState.theme.trim()
  if (applyDraft && !resolvedTheme) {
    actionError.value = 'Content theme is required.'
    return
  }
  const action = () => runMutation({ type: 'regenerate' }, async () => {
    const config = applyDraft ? createEncounterMapConfig({ ...configDraft, theme: resolvedTheme }) : undefined
    await dungeonApi.regenerateDungeon(campaignId.value, dungeonId.value, {
      scope,
      preserveLocks: true,
      seed: editState.seed,
      ...(config ? { config } : {}),
    })
    roomDraft.discard()
    await Promise.all([refresh(), refreshRooms(), refreshSnapshots(), ...(applyDraft ? [refreshLinks()] : [])])
    return true
  }, 'Unable to regenerate dungeon map.')
  if (applyDraft) {
    confirmMapRebuild(scope === 'FULL' ? 'Regenerate the whole map?' : 'Regenerate the map layout?', 'Regenerate map', action)
  } else {
    return action()
  }
}

const updateGeneratorOptions = (config: DungeonGeneratorConfigInput) => {
  if (config.mapType !== configDraft.mapType) editState.theme = config.theme
  Object.assign(configDraft, config)
}
const randomizeSeed = () => { editState.seed = `map-${Math.random().toString(36).slice(2, 10)}` }

const regenerationItems = computed(() => [
  [{ label: 'Regenerate full', icon: 'i-lucide-refresh-cw', onSelect: () => regenerate('FULL') }],
  [{ label: 'Regenerate layout', icon: 'i-lucide-grid-3x3', onSelect: () => regenerate('LAYOUT') }],
  [{ label: 'Regenerate doors', icon: 'i-lucide-door-open', onSelect: () => regenerate('DOORS') }],
  [{ label: 'Regenerate traps', icon: 'i-lucide-triangle-alert', onSelect: () => regenerate('TRAPS') }],
  [{ label: 'Regenerate encounters', icon: 'i-lucide-swords', onSelect: () => regenerate('ENCOUNTERS') }],
  [{ label: 'Regenerate treasure', icon: 'i-lucide-gem', onSelect: () => regenerate('TREASURE') }],
])

const displayedMap = computed(() => {
  if (!dungeon.value) return null
  return showPlayerSafe.value ? toPlayerSafeMap(dungeon.value.map) : dungeon.value.map
})
const floorMap = computed(() => displayedMap.value ? getDungeonFloorMap(displayedMap.value, currentFloor.value) : null)
const floorItems = computed(() => Array.from({ length: dungeon.value?.map.floorCount || 1 }, (_, value) => ({ label: dungeon.value?.map.floorLabels?.[value] || `Floor ${value + 1}`, value })))
const isForest = computed(() => dungeon.value?.map.mapType === 'FOREST')
const mapPalette = computed(() => dungeonMapPalette(dungeon.value?.map.mapType))
const legendDoors = [
  { label: 'Standard door', isSecret: false, isLocked: false },
  { label: 'Locked door', isSecret: false, isLocked: true },
  { label: 'Secret door', isSecret: true, isLocked: false },
]
const tacticalLegend = computed(() => {
  const map = floorMap.value
  if (!map) return []
  const terrain = new Set(map.terrain?.map(feature => feature.kind))
  return [
    { label: 'Cover', icon: 'i-lucide-box', present: terrain.has('COVER') },
    { label: 'High ground', icon: 'i-lucide-mountain', present: terrain.has('ELEVATION') },
    { label: 'Difficult terrain', icon: 'i-lucide-footprints', present: terrain.has('DIFFICULT') },
    { label: 'Hazard', icon: 'i-lucide-triangle-alert', present: terrain.has('HAZARD') },
    { label: 'Bridge', icon: 'i-lucide-route', present: map.corridors.some(passage => passage.kind === 'BRIDGE') },
    { label: 'Balcony', icon: 'i-lucide-panel-top', present: map.rooms.some(room => room.kind === 'BALCONY') },
    { label: 'Ladder', icon: 'i-lucide-arrow-up-down', present: map.stairs?.some(stairs => stairs.kind === 'LADDER') },
  ].filter(feature => feature.present)
})
let initializedMapId = ''
watch(dungeon, value => {
  if (!value || (value.id === initializedMapId && currentFloor.value < (value.map.floorCount || 1))) return
  const entrance = value.map.rooms.find(room => room.id === value.map.flow?.entryRoomId)
  const groundFloor = value.map.floorLabels?.indexOf('Ground floor') ?? -1
  currentFloor.value = entrance ? entrance.floor || 0 : groundFloor >= 0 ? groundFloor : 0
  initializedMapId = value.id
  currentRoomId.value = null
  selectedDoorId.value = null
}, { immediate: true })

const selectedRoom = computed(() => {
  if (!floorMap.value || !selectedRoomId.value) return null
  return floorMap.value.rooms.find((room) => room.id === selectedRoomId.value) || null
})
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

const roomEditor = reactive({
  name: '',
  description: '',
  gmNotes: '',
  playerNotes: '',
  readAloud: '',
  state: 'UNSEEN' as CampaignDungeonRoom['state'],
})
const roomAction = reactive({
  addX: 5,
  addY: 5,
  addWidth: 8,
  addHeight: 8,
  deltaX: 1,
  deltaY: 1,
  resizeWidth: 8,
  resizeHeight: 8,
})
const newLink = reactive({
  linkType: 'QUEST' as CampaignDungeonLink['linkType'],
  targetId: '',
  roomId: '__dungeon__',
})

const selectedRoomMeta = computed(() => {
  if (!selectedRoom.value || !rooms.value) return null
  return rooms.value.find((room) => room.roomNumber === selectedRoom.value?.roomNumber) || null
})
const roomSelectItems = computed(() => [
  { label: 'Whole map', value: '__dungeon__' },
  ...((rooms.value || []).filter(room => floorMap.value?.rooms.some(mapRoom => mapRoom.roomNumber === room.roomNumber)).map((room) => ({ label: `${isForest.value ? 'Clearing' : 'Room'} ${room.roomNumber}: ${room.name}`, value: room.id }))),
])
const visibleLinks = computed(() => {
  const roomIds = new Set(roomSelectItems.value.map(room => room.value))
  return (links.value || []).filter(link => !link.roomId || roomIds.has(link.roomId))
})
watch(floorMap, map => {
  if (!map?.doors.some(door => door.id === selectedDoorId.value)) selectedDoorId.value = null
})
const exportForm = reactive({
  format: 'JSON' as 'JSON' | 'SVG' | 'PNG' | 'PDF',
  mode: 'DM' as 'DM' | 'PLAYER',
  includeGrid: true,
  includeLabels: true,
  includeGmLayer: true,
})

const roomDraft = useEditorDraft(() => ({ ...roomEditor }), value => Object.assign(roomEditor, value))
const { confirmDiscard: confirmRoomDiscard } = useUnsavedChanges(roomDraft.dirty, mutationBusy)
const { confirmDiscard: confirmSettingsDiscard } = useUnsavedChanges(settingsDraft.dirty, mutationBusy)
useUnsavedChanges(() => Boolean(newLink.targetId.trim()), mutationBusy)
const selectRoom = async (id: string | null) => {
  const room = id ? displayedMap.value?.rooms.find(room => room.id === id) : null
  if (mutationBusy.value || (id && !room)) return
  if (id === currentRoomId.value && (!room || (room.floor || 0) === currentFloor.value)) return
  if (!await confirmRoomDiscard()) return
  roomDraft.discard()
  if (room && (room.floor || 0) !== currentFloor.value) {
    currentFloor.value = room.floor || 0
    selectedDoorId.value = null
    newLink.roomId = '__dungeon__'
  }
  currentRoomId.value = id
}
const selectFloor = async (floor: number) => {
  if (floor === currentFloor.value || mutationBusy.value || !await confirmRoomDiscard()) return
  roomDraft.discard()
  currentRoomId.value = null
  selectedDoorId.value = null
  newLink.roomId = '__dungeon__'
  currentFloor.value = floor
}
watch(selectedRoomMeta, value => {
  // A transient refresh must not erase a room draft when the selected room is absent.
  if (!value && roomDraft.dirty.value) return
  roomDraft.sync({
    name: value?.name || '', description: value?.description || '', gmNotes: value?.gmNotes || '',
    playerNotes: value?.playerNotes || '', readAloud: value?.readAloud || '', state: value?.state || 'UNSEEN',
  }, value?.id || '')
  if (selectedRoom.value) {
    roomAction.resizeWidth = selectedRoom.value.width
    roomAction.resizeHeight = selectedRoom.value.height
  }
}, { immediate: true })

const patchMap = async (actions: DungeonMapPatchActionInput[]) => {
  return runMutation({ type: 'patch-map' }, async () => {
    await dungeonApi.patchMap(campaignId.value, dungeonId.value, { actions })
    await Promise.all([refresh(), refreshRooms()])
    return true
  }, 'Unable to update dungeon map.')
}

const addRoom = async () => {
  await patchMap([
    {
      type: 'ADD_ROOM',
      floor: currentFloor.value,
      x: roomAction.addX,
      y: roomAction.addY,
      width: roomAction.addWidth,
      height: roomAction.addHeight,
      isSecret: false,
    },
  ])
}

const moveSelectedRoom = async () => {
  if (!selectedRoom.value) return
  await patchMap([
    {
      type: 'MOVE_ROOM',
      roomId: selectedRoom.value.id,
      x: Math.max(0, selectedRoom.value.x + roomAction.deltaX),
      y: Math.max(0, selectedRoom.value.y + roomAction.deltaY),
    },
  ])
}

const resizeSelectedRoom = async () => {
  if (!selectedRoom.value) return
  await patchMap([
    {
      type: 'RESIZE_ROOM',
      roomId: selectedRoom.value.id,
      width: roomAction.resizeWidth,
      height: roomAction.resizeHeight,
    },
  ])
}

const removeSelectedRoom = async () => {
  if (!selectedRoom.value || !await confirmRoomDiscard()) return
  const removed = await patchMap([
    {
      type: 'REMOVE_ROOM',
      roomId: selectedRoom.value.id,
    },
  ])
  if (removed) { roomDraft.discard(); currentRoomId.value = null }
}

const saveRoomMetadata = async () => {
  if (!canWriteContent.value || !selectedRoomMeta.value || mutationBusy.value) return
  const roomId = selectedRoomMeta.value.id
  const submitted = roomDraft.snapshot()
  return runMutation({ type: 'save-room' }, async () => {
    await dungeonApi.updateRoom(campaignId.value, dungeonId.value, roomId, {
      name: roomEditor.name,
      description: roomEditor.description || null,
      gmNotes: roomEditor.gmNotes || null,
      playerNotes: roomEditor.playerNotes || null,
      readAloud: roomEditor.readAloud || null,
      state: roomEditor.state,
    })
    roomDraft.accept(submitted)
    await refreshRooms()
  }, 'Unable to save room metadata.')
}

const createLink = async () => {
  return runMutation({ type: 'create-link' }, async () => {
    await dungeonApi.createLink(campaignId.value, dungeonId.value, {
      linkType: newLink.linkType,
      targetId: newLink.targetId,
      roomId: newLink.roomId === '__dungeon__' ? undefined : newLink.roomId,
    })
    newLink.targetId = ''
    await refreshLinks()
  }, 'Unable to create link.')
}

const deleteLink = async (linkId: string) => {
  return runMutation({ type: 'delete-link', recordId: linkId }, async () => {
    await dungeonApi.deleteLink(campaignId.value, dungeonId.value, linkId)
    await refreshLinks()
  }, 'Unable to delete link.')
}

const createSnapshot = async () => {
  return runMutation({ type: 'create-snapshot' }, async () => {
    await dungeonApi.createSnapshot(campaignId.value, dungeonId.value, {
      snapshotType: 'MANUAL',
    })
    await refreshSnapshots()
  }, 'Unable to create snapshot.')
}

const restoreSnapshot = async (snapshotId: string) => {
  if (!canWriteContent.value || mutationBusy.value) return
  if (!await confirmSettingsDiscard() || !await confirmRoomDiscard()) return
  confirmMapRebuild('Restore this snapshot?', 'Restore snapshot', () => runMutation({ type: 'restore-snapshot', recordId: snapshotId }, async () => {
    await dungeonApi.restoreSnapshot(campaignId.value, dungeonId.value, snapshotId)
    settingsDraft.discard()
    roomDraft.discard()
    await Promise.all([refresh(), refreshRooms(), refreshLinks()])
    return true
  }, 'Unable to restore snapshot.'))
}

const exportDungeon = async () => {
  if (isExporting.value) return
  isExporting.value = true
  actionError.value = ''
  try {
    const result = await dungeonApi.exportDungeon(campaignId.value, dungeonId.value, {
      format: exportForm.format,
      playerSafe: exportForm.mode === 'PLAYER',
      includeGrid: exportForm.includeGrid,
      includeLabels: exportForm.includeLabels,
      includeGmLayer: exportForm.includeGmLayer,
      floor: exportForm.format === 'JSON' ? undefined : currentFloor.value,
    })
    if (!result) {
      throw new Error('Empty export response.')
    }

    if (import.meta.client) {
      const payload = result.encoding === 'base64'
        ? Uint8Array.from(atob(result.content), (char) => char.charCodeAt(0))
        : result.content
      const blob = new Blob([payload], { type: result.contentType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to export dungeon.'
  } finally {
    isExporting.value = false
  }
}

const publishDungeon = async () => {
  return runMutation({ type: 'publish' }, async () => {
    if (editState.status === 'READY') {
      await dungeonApi.unpublishDungeon(campaignId.value, dungeonId.value)
    } else {
      await dungeonApi.publishDungeon(campaignId.value, dungeonId.value)
    }
    await refresh()
  }, 'Unable to change publish state.')
}

const toggleDoorLock = async () => {
  if (!selectedDoorId.value) return
  await patchMap([{ type: 'TOGGLE_DOOR_LOCK', doorId: selectedDoorId.value }])
}

const toggleDoorSecret = async () => {
  if (!selectedDoorId.value) return
  await patchMap([{ type: 'TOGGLE_DOOR_SECRET', doorId: selectedDoorId.value }])
}

const renumberRooms = async () => {
  await patchMap([{ type: 'RENUMBER_ROOMS', mode: 'AUTO' }])
}

const paintZone = async (type: 'SAFE' | 'HAZARD' | 'FACTION') => {
  if (!selectedRoom.value) return
  const cells = []
  for (let x = selectedRoom.value.x; x < selectedRoom.value.x + selectedRoom.value.width; x += 1) {
    for (let y = selectedRoom.value.y; y < selectedRoom.value.y + selectedRoom.value.height; y += 1) {
      cells.push({ x, y })
    }
  }
  await patchMap([{ type: 'PAINT_ZONE', zoneType: type, label: `${type} zone`, cells, floor: currentFloor.value }])
}

const toggleEntityLock = async (
  entityType: 'DOOR' | 'TRAP' | 'ENCOUNTER' | 'TREASURE' | 'DRESSING',
  entityId: string,
) => {
  await patchMap([{ type: 'TOGGLE_LOCK', entityType, entityId }])
}

const createEncounterFromRoom = async () => {
  if (!selectedRoomMeta.value) return
  const roomId = selectedRoomMeta.value.id
  const encounterId = await runMutation({ type: 'create-encounter' }, async () => {
    const result = await dungeonApi.createEncounterFromRoom(campaignId.value, dungeonId.value, roomId)
    if (!result) throw new Error('Encounter creation returned an empty response.')
    await refreshLinks()
    return result.encounterId
  }, 'Unable to create encounter from room.')
  if (encounterId) {
    try {
      await navigateTo(`/campaigns/${campaignId.value}/encounters/${encounterId}`)
    } catch (cause) {
      actionError.value = (cause as Error).message || 'Unable to open encounter.'
    }
  }
}

const onKeydownHandler = (event: KeyboardEvent) => {
  if (mutationBusy.value || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]'))) return
  if (event.altKey && event.key === '1') activeDetailsTab.value = 'rooms'
  if (event.altKey && event.key === '2') activeDetailsTab.value = 'corridors'
  if (event.altKey && event.key === '3') activeDetailsTab.value = 'doors'
  if (event.key === 'Delete' && canWriteContent.value && selectedRoom.value) {
    removeSelectedRoom()
  }
}

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('keydown', onKeydownHandler)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('keydown', onKeydownHandler)
})
</script>

<template>
  <fieldset :disabled="mutationBusy" class="min-w-0 space-y-6">
    <UPageHeader
      :title="dungeon?.name || 'Encounter map'"
    >
      <template #links>
        <div class="flex flex-wrap gap-2">
          <UButton
            variant="outline"
            icon="i-lucide-arrow-left"
            :to="`/campaigns/${campaignId}/dungeons`"
          >
            Back
          </UButton>
          <UButton
            :disabled="mutationBusy || !canWriteContent"
            :loading="activeMutation?.type === 'generate'"
            icon="i-lucide-sparkles"
            @click="generate"
          >
            Generate
          </UButton>
          <UButton
            :disabled="mutationBusy || !canWriteContent"
            :loading="activeMutation?.type === 'publish'"
            variant="outline"
            :icon="editState.status === 'READY' ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            @click="publishDungeon"
          >
            {{ editState.status === 'READY' ? 'Unpublish' : 'Publish' }}
          </UButton>
        </div>
      </template>
    </UPageHeader>

    <SharedReadOnlyAlert
      v-if="!canWriteContent"
      description="Your role can view this encounter map but cannot modify it."
    />
    <UAlert
      v-if="showPlayerSafe"
      color="info"
      variant="subtle"
      title="Player-safe mode enabled"
      description="Secret rooms and secret doors are hidden in this view."
    />

    <UCard v-if="pending && !dungeon" :ui="{ body: 'p-6' }">
      <p class="text-sm text-muted">Loading encounter map...</p>
    </UCard>

    <UCard v-else-if="error && !dungeon" :ui="{ body: 'p-6' }">
      <p class="text-sm text-error">Unable to load encounter map.</p>
      <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
    </UCard>

    <template v-else-if="dungeon">
      <UPage :ui="{ root: 'flex flex-col gap-4 lg:flex xl:grid xl:grid-cols-12 xl:gap-4', left: 'min-w-0 order-2 xl:order-1 xl:col-span-3', center: 'min-w-0 order-1 xl:order-2 xl:col-span-6', right: 'min-w-0 order-3 xl:col-span-3' }">
        <template #left>
          <div class="space-y-4">
            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class=" type-record">Generator Settings</h3>
              <UFormField label="Name">
                <UInput v-model="editState.name" :disabled="mutationBusy || !canWriteContent" />
              </UFormField>
              <DungeonGeneratorOptions :model-value="configDraft" :disabled="mutationBusy || !canWriteContent" @update:model-value="updateGeneratorOptions" />
              <UFormField label="Content theme" description="Used in generated names and descriptions.">
                <UInput v-model="editState.theme" :disabled="mutationBusy || !canWriteContent" placeholder="ruins, manor, woodland…" />
              </UFormField>
              <UFormField label="Seed">
                <div class="flex gap-2">
                  <UInput v-model="editState.seed" :disabled="mutationBusy || !canWriteContent" class="min-w-0 flex-1" />
                  <UButton icon="i-lucide-shuffle" variant="outline" aria-label="Randomize seed" :disabled="mutationBusy || !canWriteContent" @click="randomizeSeed" />
                </div>
              </UFormField>
              <p class="text-xs text-muted">Generate applies these settings to the whole map. Reuse the seed to repeat a layout.</p>
              <UFormField label="Status">
                <USelect
                  v-model="editState.status"
                  :disabled="mutationBusy || !canWriteContent"
                  :items="[
                    { label: 'Draft', value: 'DRAFT' },
                    { label: 'Ready', value: 'READY' },
                    { label: 'Archived', value: 'ARCHIVED' }
                  ]"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Width">
                  <UInput v-model.number="configDraft.width" type="number" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField label="Height">
                  <UInput v-model.number="configDraft.height" type="number" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
              </div>
              <div v-if="configDraft.mapType === 'DUNGEON' || (configDraft.mapType === 'FOREST' && configDraft.tacticalTerrain.cover !== 'NONE')" class="grid grid-cols-2 gap-2">
                <UFormField v-if="configDraft.mapType === 'FOREST' || configDraft.encounterScale !== 'SINGLE'" :label="configDraft.mapType === 'FOREST' ? 'Ambient cover density' : 'Room density'">
                  <UInput v-model.number="configDraft.layout.roomDensity" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField v-if="configDraft.mapType === 'DUNGEON'" label="Door frequency">
                  <UInput v-model.number="configDraft.doors.doorFrequency" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
              </div>
              <div v-if="configDraft.mapType !== 'BUILDING'" class="grid grid-cols-2 gap-2">
                <UFormField :label="configDraft.mapType === 'FOREST' ? 'Min clearing' : 'Min room'">
                  <UInput v-model.number="configDraft.layout.minRoomSize" type="number" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField :label="configDraft.mapType === 'FOREST' ? 'Max clearing' : 'Max room'">
                  <UInput v-model.number="configDraft.layout.maxRoomSize" type="number" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
              </div>
              <div v-if="configDraft.mapType === 'DUNGEON'" class="grid grid-cols-2 gap-2">
                <UFormField label="Corridor layout">
                  <USelect
                    v-model="configDraft.layout.corridorStyle"
                    :disabled="mutationBusy || !canWriteContent"
                    :items="[
                      { label: 'Straight', value: 'STRAIGHT' },
                      { label: 'Winding', value: 'WINDING' },
                      { label: 'Mixed', value: 'MIXED' }
                    ]"
                  />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Trap density">
                  <UInput v-model.number="configDraft.content.trapDensity" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField label="Encounter density">
                  <UInput v-model.number="configDraft.content.encounterDensity" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
              </div>
              <div v-if="configDraft.mapType !== 'FOREST'" class="grid grid-cols-2 gap-2">
                <UFormField v-if="configDraft.mapType === 'DUNGEON'" label="Secret room chance">
                  <UInput v-model.number="configDraft.layout.secretRoomChance" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField label="Secret door chance">
                  <UInput v-model.number="configDraft.doors.secretDoorChance" type="number" step="0.01" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  :disabled="mutationBusy || !canWriteContent"
                  :loading="activeMutation?.type === 'save-settings'"
                  variant="outline"
                  @click="saveSettings"
                >
                  Save settings
                </UButton>
                <UDropdownMenu
                  :items="regenerationItems"
                  :disabled="mutationBusy || !canWriteContent"
                >
                  <UButton
                    :disabled="mutationBusy || !canWriteContent"
                    :loading="activeMutation?.type === 'regenerate'"
                    variant="soft"
                    icon="i-lucide-refresh-cw"
                  >
                    Regenerate
                  </UButton>
                </UDropdownMenu>
              </div>
              <p v-if="actionError" class="text-xs text-error">{{ actionError }}</p>
            </UCard>
          </div>
        </template>

        <div class="space-y-4">
          <UCard :ui="{ body: 'p-4' }">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="type-record">{{ encounterMapTypes.find(item => item.value === (dungeon?.map.mapType || 'DUNGEON'))?.label }} map</h3>
              <UFormField v-if="floorItems.length > 1" label="Viewing floor">
                <USelect v-model="selectedFloor" :items="floorItems" aria-label="Viewing floor" :disabled="mutationBusy" />
              </UFormField>
            </div>
            <p class="mt-2 text-sm text-muted">
              {{ dungeon.map.width }} × {{ dungeon.map.height }} grid •
              {{ floorMap?.rooms.length }} {{ isForest ? 'clearings' : 'rooms' }} •
              {{ floorMap?.corridors.length }} {{ isForest ? 'trails' : 'passages' }} •
              {{ floorMap?.encounters.length }} encounters
            </p>
            <time :datetime="dungeon.map.metadata.generatedAt" class="mt-1 block text-xs tabular-nums text-muted">Generated {{ new Date(dungeon.map.metadata.generatedAt).toLocaleString() }}</time>
            <div class="mt-3">
              <USwitch v-model="showPlayerSafe" label="Player-safe map mode" />
            </div>
            <DungeonEncounterRoute
              v-if="dungeon.map.flow && !showPlayerSafe"
              v-model:show-route="showRoute"
              :map="dungeon.map"
              :rooms="rooms || []"
              :selected-room-id="selectedRoomId"
              :busy="mutationBusy"
              @select-room="selectRoom"
            />
          </UCard>

          <DungeonMapCanvas
            v-model:selected-room-id="selectedRoomId"
            :map="displayedMap || dungeon.map"
            :floor="currentFloor"
            :show-route="showRoute && !showPlayerSafe"
          />

          <UCard :ui="{ body: 'p-4' }">
            <h3 class=" type-record">Map Legend</h3>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div class="space-y-2 text-sm">
                <p class="font-medium">Geometry</p>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span class="inline-block h-3 w-6 rounded-sm" :style="{ backgroundColor: mapPalette.surface }" />
                  {{ isForest ? 'Trail' : 'Passage' }}
                </div>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span class="inline-block h-3 w-6" :class="isForest ? 'rounded-full' : 'rounded-sm border-2'" :style="{ borderColor: mapPalette.wall, backgroundColor: mapPalette.surface }" />
                  {{ isForest ? 'Clearing' : 'Room' }} (selected outline is highlighted)
                </div>
              </div>
              <div class="space-y-2 text-sm">
                <p class="font-medium">Markers</p>
                <div v-for="door in legendDoors" :key="door.label" class="flex items-center gap-2 text-xs text-muted">
                  <!-- Fixed renderer markup; attribute and text values are escaped. -->
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <svg viewBox="-16 -16 32 32" class="size-6 shrink-0" aria-hidden="true" v-html="renderDungeonDoorSymbol(32, door)" />
                  {{ door.label }}
                </div>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span class="inline-block h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#f97316]" />
                  Trap marker
                </div>
              </div>
            </div>
            <div v-if="tacticalLegend.length" class="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-default pt-3">
              <span v-for="feature in tacticalLegend" :key="feature.label" class="flex items-center gap-2 text-xs text-muted">
                <UIcon :name="feature.icon" class="size-4" aria-hidden="true" />
                {{ feature.label }}
              </span>
            </div>
          </UCard>
        </div>

        <template #right>
          <div class="space-y-4 xl:sticky xl:top-28">
            <UCard :ui="{ body: 'p-4' }">
              <h3 class=" type-record">Selected {{ isForest ? 'clearing' : 'room' }}</h3>
              <div v-if="selectedRoom" class="mt-2 space-y-1 text-sm">
                <p class="font-medium">{{ selectedRoom.label || `${isForest ? 'Clearing' : 'Room'} ${selectedRoom.roomNumber}` }}</p>
                <p class="text-xs text-muted">
                  Position {{ selectedRoom.x }}, {{ selectedRoom.y }} •
                  Size {{ selectedRoom.width }}x{{ selectedRoom.height }}
                </p>
                <UBadge :label="selectedRoom.isSecret ? 'Secret' : 'Visible'" :color="selectedRoom.isSecret ? 'warning' : 'neutral'" variant="subtle" />
                <section v-if="selectedRoomTerrain.length" aria-label="Room terrain" class="mt-3 border-t border-default pt-3">
                  <h4 class="type-label">Terrain</h4>
                  <dl class="mt-2 space-y-2 text-xs">
                    <div v-for="feature in selectedRoomTerrain" :key="feature.id">
                      <dt class="font-medium">{{ feature.label }}</dt>
                      <dd v-if="feature.effects" class="text-muted">{{ feature.effects }}</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <p v-else class="mt-2 text-xs text-muted">Select a room on the map to inspect details.</p>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class=" type-record">Export</h3>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Format">
                  <USelect
                    v-model="exportForm.format"
                    aria-label="Export format"
                    :items="[
                      { label: 'JSON', value: 'JSON' },
                      { label: 'SVG', value: 'SVG' },
                      { label: 'PNG', value: 'PNG' },
                      { label: 'PDF', value: 'PDF' }
                    ]"
                  />
                </UFormField>
                <UFormField label="Mode">
                  <USelect
                    v-model="exportForm.mode"
                    :items="[
                      { label: 'DM full', value: 'DM' },
                      { label: 'Player-safe', value: 'PLAYER' }
                    ]"
                  />
                </UFormField>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <USwitch v-model="exportForm.includeGrid" label="Grid" />
                <USwitch v-model="exportForm.includeLabels" label="Labels" />
                <USwitch v-model="exportForm.includeGmLayer" label="GM layer" />
              </div>
              <UButton :loading="isExporting" size="sm" variant="outline" @click="exportDungeon">
                Export map
              </UButton>
              <p v-if="floorItems.length > 1" class="text-xs text-muted">{{ exportForm.format === 'JSON' ? 'JSON includes every floor.' : `Exports ${floorItems[currentFloor]?.label}.` }}</p>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <div class="flex items-center justify-between">
                <h3 class=" type-record">Snapshots</h3>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="mutationBusy || !canWriteContent"
                  :loading="activeMutation?.type === 'create-snapshot'"
                  @click="createSnapshot"
                >
                  Create snapshot
                </UButton>
              </div>
              <div class="max-h-[220px] space-y-2 overflow-y-auto">
                <div
                  v-for="snapshot in snapshots || []"
                  :key="snapshot.id"
                  class="flex items-center justify-between rounded-md border border-default px-3 py-2 text-xs"
                >
                  <div class="space-y-1">
                    <p class="font-medium">{{ snapshot.snapshotType }}</p>
                    <p class="text-muted">{{ new Date(snapshot.createdAt).toLocaleString() }}</p>
                  </div>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :disabled="mutationBusy || !canWriteContent"
                    :loading="activeMutation?.type === 'restore-snapshot' && activeMutation.recordId === snapshot.id"
                    @click="restoreSnapshot(snapshot.id)"
                  >
                    Restore
                  </UButton>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class=" type-record">Room Metadata</h3>
              <template v-if="selectedRoomMeta">
                <UFormField label="Name">
                  <UInput v-model="roomEditor.name" :disabled="mutationBusy || !canWriteContent" />
                </UFormField>
                <UFormField label="State">
                  <USelect
                    v-model="roomEditor.state"
                    :disabled="mutationBusy || !canWriteContent"
                    :items="[
                      { label: 'Unseen', value: 'UNSEEN' },
                      { label: 'Explored', value: 'EXPLORED' },
                      { label: 'Cleared', value: 'CLEARED' },
                      { label: 'Contested', value: 'CONTESTED' }
                    ]"
                  />
                </UFormField>
                <UFormField label="Description">
                  <UTextarea v-model="roomEditor.description" :disabled="mutationBusy || !canWriteContent" :rows="3" />
                </UFormField>
                <UFormField label="GM notes">
                  <UTextarea v-model="roomEditor.gmNotes" :disabled="mutationBusy || !canWriteContent" :rows="3" />
                </UFormField>
                <UFormField label="Player notes">
                  <UTextarea v-model="roomEditor.playerNotes" :disabled="mutationBusy || !canWriteContent" :rows="2" />
                </UFormField>
                <UFormField label="Read-aloud">
                  <UTextarea v-model="roomEditor.readAloud" :disabled="mutationBusy || !canWriteContent" :rows="2" />
                </UFormField>
                <UButton
                  :disabled="mutationBusy || !canWriteContent"
                  :loading="activeMutation?.type === 'save-room'"
                  size="sm"
                  @click="saveRoomMetadata"
                >
                  Save metadata
                </UButton>
                <UButton
                  :disabled="mutationBusy || !canWriteContent"
                  :loading="activeMutation?.type === 'create-encounter'"
                  size="sm"
                  variant="soft"
                  @click="createEncounterFromRoom"
                >
                  Create encounter from room
                </UButton>
              </template>
              <p v-else class="text-xs text-muted">Select a room to edit metadata.</p>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class=" type-record">Map Edit Tools</h3>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Add X"><UInput v-model.number="roomAction.addX" type="number" :disabled="mutationBusy || !canWriteContent" /></UFormField>
                <UFormField label="Add Y"><UInput v-model.number="roomAction.addY" type="number" :disabled="mutationBusy || !canWriteContent" /></UFormField>
                <UFormField label="Add W"><UInput v-model.number="roomAction.addWidth" type="number" :disabled="mutationBusy || !canWriteContent" /></UFormField>
                <UFormField label="Add H"><UInput v-model.number="roomAction.addHeight" type="number" :disabled="mutationBusy || !canWriteContent" /></UFormField>
              </div>
              <UButton :disabled="mutationBusy || !canWriteContent" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="addRoom">
                Add room
              </UButton>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Delta X"><UInput v-model.number="roomAction.deltaX" type="number" :disabled="mutationBusy || !canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Delta Y"><UInput v-model.number="roomAction.deltaY" type="number" :disabled="mutationBusy || !canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Resize W"><UInput v-model.number="roomAction.resizeWidth" type="number" :disabled="mutationBusy || !canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Resize H"><UInput v-model.number="roomAction.resizeHeight" type="number" :disabled="mutationBusy || !canWriteContent || !selectedRoom" /></UFormField>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedRoom" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="soft" @click="moveSelectedRoom">
                  Move room
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedRoom" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="soft" @click="resizeSelectedRoom">
                  Resize room
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedRoom" :loading="activeMutation?.type === 'patch-map'" size="sm" color="error" variant="outline" @click="removeSelectedRoom">
                  Remove room
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="renumberRooms">
                  Renumber rooms
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedRoom" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="paintZone('SAFE')">
                  Paint safe zone
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedRoom" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="paintZone('HAZARD')">
                  Paint hazard zone
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedDoorId" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="toggleDoorLock">
                  Toggle door lock
                </UButton>
                <UButton :disabled="mutationBusy || !canWriteContent || !selectedDoorId" :loading="activeMutation?.type === 'patch-map'" size="sm" variant="outline" @click="toggleDoorSecret">
                  Toggle door secret
                </UButton>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class=" type-record">Links</h3>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Type">
                  <USelect
                    v-model="newLink.linkType"
                    :disabled="mutationBusy || !canWriteContent"
                    :items="[
                      { label: 'Quest', value: 'QUEST' },
                      { label: 'Session', value: 'SESSION' },
                      { label: 'Milestone', value: 'MILESTONE' },
                      { label: 'Glossary', value: 'GLOSSARY' },
                      { label: 'Encounter', value: 'ENCOUNTER' }
                    ]"
                  />
                </UFormField>
                <UFormField label="Room (optional)">
                  <USelect
                    v-model="newLink.roomId"
                    :disabled="mutationBusy || !canWriteContent"
                    :items="roomSelectItems"
                  />
                </UFormField>
              </div>
              <UFormField label="Target id">
                <UInput v-model="newLink.targetId" :disabled="mutationBusy || !canWriteContent" placeholder="quest-id / session-id / etc" />
              </UFormField>
              <UButton
                :disabled="mutationBusy || !canWriteContent || !newLink.targetId.trim()"
                :loading="activeMutation?.type === 'create-link'"
                size="sm"
                @click="createLink"
              >
                Add link
              </UButton>

              <div class="max-h-[220px] space-y-2 overflow-y-auto">
                <div
                  v-for="link in visibleLinks"
                  :key="link.id"
                  class="flex items-center justify-between rounded-md border border-default px-3 py-2 text-xs"
                >
                  <div class="space-y-1">
                    <p class="font-medium">{{ link.linkType }} → {{ link.targetId }}</p>
                    <p class="text-muted">{{ link.roomId ? `Room link: ${link.roomId}` : 'Map link' }}</p>
                  </div>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    :disabled="mutationBusy || !canWriteContent"
                    :loading="activeMutation?.type === 'delete-link' && activeMutation.recordId === link.id"
                    @click="deleteLink(link.id)"
                  >
                    Delete
                  </UButton>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-4' }">
              <UTabs
                v-model="activeDetailsTab"
                :ui="{ list: 'flex-wrap', trigger: 'flex-none' }"
                :items="[
                  { label: `${isForest ? 'Clearings' : 'Rooms'} (${floorMap!.rooms.length})`, value: 'rooms' },
                  { label: `${isForest ? 'Trails' : 'Passages'} (${floorMap!.corridors.length})`, value: 'corridors' },
                  { label: `Doors (${floorMap!.doors.length})`, value: 'doors' },
                  { label: `Traps (${floorMap!.traps.length})`, value: 'traps' },
                  { label: `Encounters (${floorMap!.encounters.length})`, value: 'encounters' },
                  { label: `Treasure (${floorMap!.treasures.length})`, value: 'treasure' },
                  { label: `Zones (${floorMap!.zones.length})`, value: 'zones' }
                ]"
                :content="false"
              />
              <div v-if="activeDetailsTab === 'rooms'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto">
                <button
                  v-for="room in floorMap!.rooms"
                  :key="room.id"
                  type="button"
                  class="w-full rounded-md border border-default px-3 py-2 text-left text-sm hover:bg-elevated"
                  @click="selectedRoomId = room.id"
                >
                  {{ room.label || `${isForest ? 'Clearing' : 'Room'} ${room.roomNumber}` }} • {{ room.width }} × {{ room.height }}
                </button>
              </div>
              <div v-else-if="activeDetailsTab === 'corridors'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="corridor in floorMap!.corridors"
                  :key="corridor.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ corridor.id }} • {{ corridor.fromRoomId }} → {{ corridor.toRoomId }}
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'doors'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <button
                  v-for="door in floorMap!.doors"
                  :key="door.id"
                  type="button"
                  class="w-full rounded-md border border-default px-3 py-2 text-left hover:bg-elevated"
                  :aria-pressed="selectedDoorId === door.id"
                  @click="selectedDoorId = door.id"
                >
                  {{ door.id }} • x:{{ door.x }}, y:{{ door.y }} • {{ door.isLocked ? 'Locked' : 'Unlocked' }}
                </button>
              </div>
              <div v-else-if="activeDetailsTab === 'traps'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="trap in floorMap!.traps"
                  :key="trap.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ trap.name }} • {{ trap.severity }} • {{ trap.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('TRAP', trap.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'encounters'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="encounter in floorMap!.encounters"
                  :key="encounter.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ encounter.title }} • {{ encounter.difficulty }} • {{ encounter.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('ENCOUNTER', encounter.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'treasure'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="treasure in floorMap!.treasures"
                  :key="treasure.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ treasure.category }} • {{ treasure.rarity }} • {{ treasure.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('TREASURE', treasure.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="zone in floorMap!.zones"
                  :key="zone.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ zone.type }} • {{ zone.label }} • {{ zone.cells.length }} cells
                </div>
              </div>
            </UCard>

            <p v-if="actionError" class="text-xs text-error">{{ actionError }}</p>
          </div>
        </template>
      </UPage>
    </template>
    <SharedConfirmActionModal
      v-if="rebuildConfirmation"
      v-model:open="rebuildOpen"
      :title="rebuildConfirmation.title"
      description="This replaces the map and resets saved room details."
      :confirm-label="rebuildConfirmation.confirmLabel"
      :action="rebuildConfirmation.action"
    >
      <template #content>
        <ul class="list-disc space-y-2 pl-5 text-sm">
          <li>Saved room names, descriptions, notes, read-aloud text, tags, and explored states are reset.</li>
          <li>Room links lose their room associations and become whole-map links.</li>
        </ul>
        <p class="text-sm text-muted">Snapshots preserve the map layout and generator settings; they do not restore saved room details or room-link associations.</p>
      </template>
    </SharedConfirmActionModal>
  </fieldset>
</template>
