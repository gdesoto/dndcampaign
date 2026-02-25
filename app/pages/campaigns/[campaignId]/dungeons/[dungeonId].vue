<script setup lang="ts">
import type { CampaignDungeonLink, CampaignDungeonRegenerateScope, CampaignDungeonRoom } from '#shared/types/dungeon'
import type { DungeonGeneratorConfigInput, DungeonMapPatchActionInput } from '#shared/schemas/dungeon'

definePageMeta({ layout: 'default' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const dungeonId = computed(() => route.params.dungeonId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const dungeonApi = useDungeonDetail()

const actionError = ref('')
const isSaving = ref(false)
const isGenerating = ref(false)
const isRegenerating = ref(false)
const isSavingRoom = ref(false)
const isPatchingMap = ref(false)
const isCreatingLink = ref(false)
const isCreatingSnapshot = ref(false)
const restoringSnapshotId = ref('')
const isExporting = ref(false)
const isPublishing = ref(false)
const isCreatingEncounter = ref(false)
const deletingLinkId = ref('')
const selectedRoomId = ref<string | null>(null)
const selectedDoorId = ref<string | null>(null)
const activeDetailsTab = ref<'rooms' | 'corridors' | 'doors' | 'traps' | 'encounters' | 'treasure' | 'zones'>('rooms')
const showPlayerSafe = ref(false)

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

const configDraft = reactive<DungeonGeneratorConfigInput>({
  gridType: 'SQUARE',
  width: 80,
  height: 80,
  cellSize: 32,
  theme: 'ruins',
  layout: {
    roomDensity: 0.25,
    minRoomSize: 4,
    maxRoomSize: 10,
    corridorStyle: 'MIXED',
    connectivityStrictness: 0.7,
    secretRoomChance: 0.1,
  },
  doors: {
    doorFrequency: 0.65,
    lockedDoorChance: 0.2,
    secretDoorChance: 0.08,
    specialDoorChance: 0.05,
  },
  content: {
    trapDensity: 0.15,
    encounterDensity: 0.3,
    treasureDensity: 0.2,
    dressingDensity: 0.35,
  },
})

watch(
  () => dungeon.value,
  (value) => {
    if (!value) return
    editState.name = value.name
    editState.theme = value.theme
    editState.seed = value.seed
    editState.status = value.status

    configDraft.gridType = value.config.gridType
    configDraft.width = value.config.width
    configDraft.height = value.config.height
    configDraft.cellSize = value.config.cellSize
    configDraft.theme = value.config.theme
    configDraft.layout = { ...value.config.layout }
    configDraft.doors = { ...value.config.doors }
    configDraft.content = { ...value.config.content }
  },
  { immediate: true },
)

const saveSettings = async () => {
  if (!canWriteContent.value) return
  isSaving.value = true
  actionError.value = ''
  try {
    await dungeonApi.updateDungeon(campaignId.value, dungeonId.value, {
      name: editState.name,
      theme: editState.theme,
      seed: editState.seed,
      status: editState.status,
      config: {
        ...configDraft,
        theme: editState.theme,
      },
    })
    await refresh()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to save dungeon settings.'
  } finally {
    isSaving.value = false
  }
}

const generate = async () => {
  if (!canWriteContent.value) return
  isGenerating.value = true
  actionError.value = ''
  try {
    await dungeonApi.generateDungeon(campaignId.value, dungeonId.value, {
      seed: editState.seed,
      config: {
        ...configDraft,
        theme: editState.theme,
      },
    })
    await refresh()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to generate dungeon map.'
  } finally {
    isGenerating.value = false
  }
}

const regenerate = async (scope: CampaignDungeonRegenerateScope) => {
  if (!canWriteContent.value) return
  isRegenerating.value = true
  actionError.value = ''
  try {
    await dungeonApi.regenerateDungeon(campaignId.value, dungeonId.value, {
      scope,
      preserveLocks: true,
      seed: editState.seed,
    })
    await refresh()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to regenerate dungeon map.'
  } finally {
    isRegenerating.value = false
  }
}

const applyPreset = (preset: 'small_one_shot' | 'mega_wing' | 'story') => {
  if (preset === 'small_one_shot') {
    configDraft.width = 60
    configDraft.height = 60
    configDraft.cellSize = 32
    configDraft.layout.roomDensity = 0.2
    configDraft.layout.minRoomSize = 4
    configDraft.layout.maxRoomSize = 9
    configDraft.layout.corridorStyle = 'STRAIGHT'
    configDraft.doors.doorFrequency = 0.55
    return
  }
  if (preset === 'mega_wing') {
    configDraft.width = 140
    configDraft.height = 140
    configDraft.cellSize = 24
    configDraft.layout.roomDensity = 0.35
    configDraft.layout.minRoomSize = 4
    configDraft.layout.maxRoomSize = 14
    configDraft.layout.corridorStyle = 'MIXED'
    configDraft.doors.doorFrequency = 0.75
    return
  }

  configDraft.width = 90
  configDraft.height = 90
  configDraft.cellSize = 32
  configDraft.layout.roomDensity = 0.28
  configDraft.layout.minRoomSize = 4
  configDraft.layout.maxRoomSize = 11
  configDraft.layout.corridorStyle = 'WINDING'
  configDraft.doors.doorFrequency = 0.65
}

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
  if (!showPlayerSafe.value) return dungeon.value.map
  const visibleRoomIds = new Set(dungeon.value.map.rooms.filter((room) => !room.isSecret).map((room) => room.id))
  const corridors = dungeon.value.map.corridors.filter(
    (corridor) => visibleRoomIds.has(corridor.fromRoomId) && visibleRoomIds.has(corridor.toRoomId),
  )
  const corridorIds = new Set(corridors.map((corridor) => corridor.id))
  return {
    ...dungeon.value.map,
    rooms: dungeon.value.map.rooms.filter((room) => !room.isSecret),
    corridors,
    doors: dungeon.value.map.doors.filter((door) => !door.isSecret && corridorIds.has(door.corridorId)),
  }
})

const selectedRoom = computed(() => {
  if (!dungeon.value || !selectedRoomId.value) return null
  return dungeon.value.map.rooms.find((room) => room.id === selectedRoomId.value) || null
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
  { label: 'Dungeon-level', value: '__dungeon__' },
  ...((rooms.value || []).map((room) => ({ label: `Room ${room.roomNumber}: ${room.name}`, value: room.id }))),
])
const exportForm = reactive({
  format: 'JSON' as 'JSON' | 'SVG' | 'PNG' | 'PDF',
  mode: 'DM' as 'DM' | 'PLAYER',
  includeGrid: true,
  includeLabels: true,
  includeGmLayer: true,
})

watch(
  () => selectedRoomMeta.value,
  (value) => {
    roomEditor.name = value?.name || ''
    roomEditor.description = value?.description || ''
    roomEditor.gmNotes = value?.gmNotes || ''
    roomEditor.playerNotes = value?.playerNotes || ''
    roomEditor.readAloud = value?.readAloud || ''
    roomEditor.state = value?.state || 'UNSEEN'
    if (selectedRoom.value) {
      roomAction.resizeWidth = selectedRoom.value.width
      roomAction.resizeHeight = selectedRoom.value.height
    }
  },
  { immediate: true },
)

const patchMap = async (actions: DungeonMapPatchActionInput[]) => {
  if (!canWriteContent.value) return
  isPatchingMap.value = true
  actionError.value = ''
  try {
    await dungeonApi.patchMap(campaignId.value, dungeonId.value, { actions })
    await Promise.all([refresh(), refreshRooms()])
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to update dungeon map.'
  } finally {
    isPatchingMap.value = false
  }
}

const addRoom = async () => {
  await patchMap([
    {
      type: 'ADD_ROOM',
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
  if (!selectedRoom.value) return
  await patchMap([
    {
      type: 'REMOVE_ROOM',
      roomId: selectedRoom.value.id,
    },
  ])
  selectedRoomId.value = null
}

const saveRoomMetadata = async () => {
  if (!canWriteContent.value || !selectedRoomMeta.value) return
  isSavingRoom.value = true
  actionError.value = ''
  try {
    await dungeonApi.updateRoom(campaignId.value, dungeonId.value, selectedRoomMeta.value.id, {
      name: roomEditor.name,
      description: roomEditor.description || null,
      gmNotes: roomEditor.gmNotes || null,
      playerNotes: roomEditor.playerNotes || null,
      readAloud: roomEditor.readAloud || null,
      state: roomEditor.state,
    })
    await refreshRooms()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to save room metadata.'
  } finally {
    isSavingRoom.value = false
  }
}

const createLink = async () => {
  if (!canWriteContent.value) return
  isCreatingLink.value = true
  actionError.value = ''
  try {
    await dungeonApi.createLink(campaignId.value, dungeonId.value, {
      linkType: newLink.linkType,
      targetId: newLink.targetId,
      roomId: newLink.roomId === '__dungeon__' ? undefined : newLink.roomId,
    })
    newLink.targetId = ''
    await refreshLinks()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to create link.'
  } finally {
    isCreatingLink.value = false
  }
}

const deleteLink = async (linkId: string) => {
  if (!canWriteContent.value) return
  deletingLinkId.value = linkId
  actionError.value = ''
  try {
    await dungeonApi.deleteLink(campaignId.value, dungeonId.value, linkId)
    await refreshLinks()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to delete link.'
  } finally {
    deletingLinkId.value = ''
  }
}

const createSnapshot = async () => {
  if (!canWriteContent.value) return
  isCreatingSnapshot.value = true
  actionError.value = ''
  try {
    await dungeonApi.createSnapshot(campaignId.value, dungeonId.value, {
      snapshotType: 'MANUAL',
    })
    await refreshSnapshots()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to create snapshot.'
  } finally {
    isCreatingSnapshot.value = false
  }
}

const restoreSnapshot = async (snapshotId: string) => {
  if (!canWriteContent.value) return
  restoringSnapshotId.value = snapshotId
  actionError.value = ''
  try {
    await dungeonApi.restoreSnapshot(campaignId.value, dungeonId.value, snapshotId)
    await Promise.all([refresh(), refreshRooms(), refreshLinks()])
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to restore snapshot.'
  } finally {
    restoringSnapshotId.value = ''
  }
}

const exportDungeon = async () => {
  isExporting.value = true
  actionError.value = ''
  try {
    const result = await dungeonApi.exportDungeon(campaignId.value, dungeonId.value, {
      format: exportForm.format,
      playerSafe: exportForm.mode === 'PLAYER',
      includeGrid: exportForm.includeGrid,
      includeLabels: exportForm.includeLabels,
      includeGmLayer: exportForm.includeGmLayer,
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
  if (!canWriteContent.value) return
  isPublishing.value = true
  actionError.value = ''
  try {
    if (editState.status === 'READY') {
      await dungeonApi.unpublishDungeon(campaignId.value, dungeonId.value)
    } else {
      await dungeonApi.publishDungeon(campaignId.value, dungeonId.value)
    }
    await refresh()
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to change publish state.'
  } finally {
    isPublishing.value = false
  }
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
  await patchMap([{ type: 'PAINT_ZONE', zoneType: type, label: `${type} zone`, cells }])
}

const toggleEntityLock = async (
  entityType: 'DOOR' | 'TRAP' | 'ENCOUNTER' | 'TREASURE' | 'DRESSING',
  entityId: string,
) => {
  await patchMap([{ type: 'TOGGLE_LOCK', entityType, entityId }])
}

const createEncounterFromRoom = async () => {
  if (!selectedRoomMeta.value) return
  isCreatingEncounter.value = true
  actionError.value = ''
  try {
    const result = await dungeonApi.createEncounterFromRoom(
      campaignId.value,
      dungeonId.value,
      selectedRoomMeta.value.id,
    )
    if (!result) {
      throw new Error('Encounter creation returned an empty response.')
    }
    await refreshLinks()
    await navigateTo(`/campaigns/${campaignId.value}/encounters/${result.encounterId}`)
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to create encounter from room.'
  } finally {
    isCreatingEncounter.value = false
  }
}

const onKeydownHandler = (event: KeyboardEvent) => {
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
  <div class="space-y-6">
    <UPageHeader
      title="Dungeon Detail"
      :description="dungeon ? `${dungeon.theme} • ${dungeon.seed}` : 'Loading dungeon...'"
      headline="Dungeon Builder"
    >
      <template #right>
        <div class="flex flex-wrap gap-2">
          <UButton
            variant="outline"
            icon="i-lucide-arrow-left"
            :to="`/campaigns/${campaignId}/dungeons`"
          >
            Back
          </UButton>
          <UButton
            :disabled="!canWriteContent"
            :loading="isGenerating"
            icon="i-lucide-sparkles"
            @click="generate"
          >
            Generate
          </UButton>
          <UButton
            :disabled="!canWriteContent"
            :loading="isPublishing"
            variant="outline"
            :icon="editState.status === 'READY' ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            @click="publishDungeon"
          >
            {{ editState.status === 'READY' ? 'Unpublish' : 'Publish' }}
          </UButton>
        </div>
      </template>
    </UPageHeader>

    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="Your role can view this dungeon but cannot modify generation settings."
    />
    <UAlert
      v-if="showPlayerSafe"
      color="info"
      variant="subtle"
      title="Player-safe mode enabled"
      description="Secret rooms and secret doors are hidden in this view."
    />

    <UCard v-if="pending" :ui="{ body: 'p-6' }">
      <p class="text-sm text-muted">Loading dungeon...</p>
    </UCard>

    <UCard v-else-if="error" :ui="{ body: 'p-6' }">
      <p class="text-sm text-error">Unable to load dungeon.</p>
      <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
    </UCard>

    <template v-else-if="dungeon">
      <UPage :ui="{ left: 'hidden xl:block xl:col-span-3', center: 'xl:col-span-6', right: 'xl:col-span-3' }">
        <template #left>
          <div class="space-y-4 lg:sticky lg:top-28">
            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class="text-sm font-semibold">Generator Settings</h3>
              <div class="grid grid-cols-3 gap-2">
                <UButton size="xs" variant="soft" :disabled="!canWriteContent" @click="applyPreset('small_one_shot')">One-shot</UButton>
                <UButton size="xs" variant="soft" :disabled="!canWriteContent" @click="applyPreset('mega_wing')">Mega wing</UButton>
                <UButton size="xs" variant="soft" :disabled="!canWriteContent" @click="applyPreset('story')">Story</UButton>
              </div>
              <UFormField label="Name">
                <UInput v-model="editState.name" :disabled="!canWriteContent" />
              </UFormField>
              <UFormField label="Theme">
                <UInput v-model="editState.theme" :disabled="!canWriteContent" />
              </UFormField>
              <UFormField label="Seed">
                <UInput v-model="editState.seed" :disabled="!canWriteContent" />
              </UFormField>
              <UFormField label="Status">
                <USelect
                  v-model="editState.status"
                  :disabled="!canWriteContent"
                  :items="[
                    { label: 'Draft', value: 'DRAFT' },
                    { label: 'Ready', value: 'READY' },
                    { label: 'Archived', value: 'ARCHIVED' }
                  ]"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Width">
                  <UInput v-model.number="configDraft.width" type="number" :disabled="!canWriteContent" />
                </UFormField>
                <UFormField label="Height">
                  <UInput v-model.number="configDraft.height" type="number" :disabled="!canWriteContent" />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Room density">
                  <UInput v-model.number="configDraft.layout.roomDensity" type="number" step="0.01" :disabled="!canWriteContent" />
                </UFormField>
                <UFormField label="Door frequency">
                  <UInput v-model.number="configDraft.doors.doorFrequency" type="number" step="0.01" :disabled="!canWriteContent" />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Min room">
                  <UInput v-model.number="configDraft.layout.minRoomSize" type="number" :disabled="!canWriteContent" />
                </UFormField>
                <UFormField label="Max room">
                  <UInput v-model.number="configDraft.layout.maxRoomSize" type="number" :disabled="!canWriteContent" />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Trap density">
                  <UInput v-model.number="configDraft.content.trapDensity" type="number" step="0.01" :disabled="!canWriteContent" />
                </UFormField>
                <UFormField label="Encounter density">
                  <UInput v-model.number="configDraft.content.encounterDensity" type="number" step="0.01" :disabled="!canWriteContent" />
                </UFormField>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  :disabled="!canWriteContent"
                  :loading="isSaving"
                  variant="outline"
                  @click="saveSettings"
                >
                  Save settings
                </UButton>
                <UDropdownMenu
                  :items="regenerationItems"
                  :disabled="!canWriteContent || isRegenerating"
                >
                  <UButton
                    :disabled="!canWriteContent"
                    :loading="isRegenerating"
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
            <h3 class="text-sm font-semibold">Map Summary</h3>
            <p class="mt-2 text-sm text-muted">
              {{ dungeon.map.width }}x{{ dungeon.map.height }} grid •
              {{ dungeon.map.rooms.length }} rooms •
              {{ dungeon.map.corridors.length }} corridors •
              {{ dungeon.map.doors.length }} doors •
              {{ dungeon.map.traps.length }} traps •
              {{ dungeon.map.encounters.length }} encounters •
              {{ dungeon.map.treasures.length }} treasure
            </p>
            <p class="mt-1 text-xs text-muted">
              Generator {{ dungeon.map.metadata.algorithmVersion }} •
              hash {{ dungeon.map.metadata.configHash }} •
              {{ new Date(dungeon.map.metadata.generatedAt).toLocaleString() }}
            </p>
            <div class="mt-3">
              <USwitch v-model="showPlayerSafe" label="Player-safe map mode" />
            </div>
          </UCard>

          <DungeonMapCanvas
            v-model:selected-room-id="selectedRoomId"
            :map="displayedMap || dungeon.map"
          />
        </div>

        <template #right>
          <div class="space-y-4 xl:sticky xl:top-28">
            <UCard :ui="{ body: 'p-4' }">
              <h3 class="text-sm font-semibold">Selected Room</h3>
              <div v-if="selectedRoom" class="mt-2 space-y-1 text-sm">
                <p class="font-medium">Room {{ selectedRoom.roomNumber }}</p>
                <p class="text-xs text-muted">
                  Position {{ selectedRoom.x }}, {{ selectedRoom.y }} •
                  Size {{ selectedRoom.width }}x{{ selectedRoom.height }}
                </p>
                <UBadge :label="selectedRoom.isSecret ? 'Secret' : 'Visible'" :color="selectedRoom.isSecret ? 'warning' : 'neutral'" variant="subtle" />
              </div>
              <p v-else class="mt-2 text-xs text-muted">Select a room on the map to inspect details.</p>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class="text-sm font-semibold">Export</h3>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Format">
                  <USelect
                    v-model="exportForm.format"
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
                Export dungeon
              </UButton>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">Snapshots</h3>
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="!canWriteContent"
                  :loading="isCreatingSnapshot"
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
                    :disabled="!canWriteContent"
                    :loading="restoringSnapshotId === snapshot.id"
                    @click="restoreSnapshot(snapshot.id)"
                  >
                    Restore
                  </UButton>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class="text-sm font-semibold">Room Metadata</h3>
              <template v-if="selectedRoomMeta">
                <UFormField label="Name">
                  <UInput v-model="roomEditor.name" :disabled="!canWriteContent" />
                </UFormField>
                <UFormField label="State">
                  <USelect
                    v-model="roomEditor.state"
                    :disabled="!canWriteContent"
                    :items="[
                      { label: 'Unseen', value: 'UNSEEN' },
                      { label: 'Explored', value: 'EXPLORED' },
                      { label: 'Cleared', value: 'CLEARED' },
                      { label: 'Contested', value: 'CONTESTED' }
                    ]"
                  />
                </UFormField>
                <UFormField label="Description">
                  <UTextarea v-model="roomEditor.description" :disabled="!canWriteContent" :rows="3" />
                </UFormField>
                <UFormField label="GM notes">
                  <UTextarea v-model="roomEditor.gmNotes" :disabled="!canWriteContent" :rows="3" />
                </UFormField>
                <UFormField label="Player notes">
                  <UTextarea v-model="roomEditor.playerNotes" :disabled="!canWriteContent" :rows="2" />
                </UFormField>
                <UFormField label="Read-aloud">
                  <UTextarea v-model="roomEditor.readAloud" :disabled="!canWriteContent" :rows="2" />
                </UFormField>
                <UButton
                  :disabled="!canWriteContent"
                  :loading="isSavingRoom"
                  size="sm"
                  @click="saveRoomMetadata"
                >
                  Save metadata
                </UButton>
                <UButton
                  :disabled="!canWriteContent"
                  :loading="isCreatingEncounter"
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
              <h3 class="text-sm font-semibold">Map Edit Tools</h3>
              <p class="text-xs text-muted">Basic geometry tools for milestone 3.</p>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Add X"><UInput v-model.number="roomAction.addX" type="number" :disabled="!canWriteContent" /></UFormField>
                <UFormField label="Add Y"><UInput v-model.number="roomAction.addY" type="number" :disabled="!canWriteContent" /></UFormField>
                <UFormField label="Add W"><UInput v-model.number="roomAction.addWidth" type="number" :disabled="!canWriteContent" /></UFormField>
                <UFormField label="Add H"><UInput v-model.number="roomAction.addHeight" type="number" :disabled="!canWriteContent" /></UFormField>
              </div>
              <UButton :disabled="!canWriteContent" :loading="isPatchingMap" size="sm" variant="outline" @click="addRoom">
                Add room
              </UButton>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Delta X"><UInput v-model.number="roomAction.deltaX" type="number" :disabled="!canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Delta Y"><UInput v-model.number="roomAction.deltaY" type="number" :disabled="!canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Resize W"><UInput v-model.number="roomAction.resizeWidth" type="number" :disabled="!canWriteContent || !selectedRoom" /></UFormField>
                <UFormField label="Resize H"><UInput v-model.number="roomAction.resizeHeight" type="number" :disabled="!canWriteContent || !selectedRoom" /></UFormField>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton :disabled="!canWriteContent || !selectedRoom" :loading="isPatchingMap" size="sm" variant="soft" @click="moveSelectedRoom">
                  Move room
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedRoom" :loading="isPatchingMap" size="sm" variant="soft" @click="resizeSelectedRoom">
                  Resize room
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedRoom" :loading="isPatchingMap" size="sm" color="error" variant="outline" @click="removeSelectedRoom">
                  Remove room
                </UButton>
                <UButton :disabled="!canWriteContent" :loading="isPatchingMap" size="sm" variant="outline" @click="renumberRooms">
                  Renumber rooms
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedRoom" :loading="isPatchingMap" size="sm" variant="outline" @click="paintZone('SAFE')">
                  Paint safe zone
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedRoom" :loading="isPatchingMap" size="sm" variant="outline" @click="paintZone('HAZARD')">
                  Paint hazard zone
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedDoorId" :loading="isPatchingMap" size="sm" variant="outline" @click="toggleDoorLock">
                  Toggle door lock
                </UButton>
                <UButton :disabled="!canWriteContent || !selectedDoorId" :loading="isPatchingMap" size="sm" variant="outline" @click="toggleDoorSecret">
                  Toggle door secret
                </UButton>
              </div>
            </UCard>

            <UCard :ui="{ body: 'p-4 space-y-3' }">
              <h3 class="text-sm font-semibold">Links</h3>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Type">
                  <USelect
                    v-model="newLink.linkType"
                    :disabled="!canWriteContent"
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
                    :disabled="!canWriteContent"
                    :items="roomSelectItems"
                  />
                </UFormField>
              </div>
              <UFormField label="Target id">
                <UInput v-model="newLink.targetId" :disabled="!canWriteContent" placeholder="quest-id / session-id / etc" />
              </UFormField>
              <UButton
                :disabled="!canWriteContent || !newLink.targetId.trim()"
                :loading="isCreatingLink"
                size="sm"
                @click="createLink"
              >
                Add link
              </UButton>

              <div class="max-h-[220px] space-y-2 overflow-y-auto">
                <div
                  v-for="link in links || []"
                  :key="link.id"
                  class="flex items-center justify-between rounded-md border border-default px-3 py-2 text-xs"
                >
                  <div class="space-y-1">
                    <p class="font-medium">{{ link.linkType }} → {{ link.targetId }}</p>
                    <p class="text-muted">{{ link.roomId ? `Room link: ${link.roomId}` : 'Dungeon-level link' }}</p>
                  </div>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    :disabled="!canWriteContent"
                    :loading="deletingLinkId === link.id"
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
                :items="[
                  { label: `Rooms (${dungeon.map.rooms.length})`, value: 'rooms' },
                  { label: `Corridors (${dungeon.map.corridors.length})`, value: 'corridors' },
                  { label: `Doors (${dungeon.map.doors.length})`, value: 'doors' },
                  { label: `Traps (${dungeon.map.traps.length})`, value: 'traps' },
                  { label: `Encounters (${dungeon.map.encounters.length})`, value: 'encounters' },
                  { label: `Treasure (${dungeon.map.treasures.length})`, value: 'treasure' },
                  { label: `Zones (${dungeon.map.zones.length})`, value: 'zones' }
                ]"
                :content="false"
              />
              <div v-if="activeDetailsTab === 'rooms'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto">
                <button
                  v-for="room in dungeon.map.rooms"
                  :key="room.id"
                  type="button"
                  class="w-full rounded-md border border-default px-3 py-2 text-left text-sm hover:bg-elevated"
                  @click="selectedRoomId = room.id"
                >
                  Room {{ room.roomNumber }} • {{ room.width }}x{{ room.height }}
                </button>
              </div>
              <div v-else-if="activeDetailsTab === 'corridors'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="corridor in dungeon.map.corridors"
                  :key="corridor.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ corridor.id }} • {{ corridor.fromRoomId }} → {{ corridor.toRoomId }}
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'doors'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="door in dungeon.map.doors"
                  :key="door.id"
                  class="cursor-pointer rounded-md border border-default px-3 py-2"
                  @click="selectedDoorId = door.id"
                >
                  {{ door.id }} • x:{{ door.x }}, y:{{ door.y }} • {{ door.isLocked ? 'Locked' : 'Unlocked' }}
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'traps'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="trap in dungeon.map.traps"
                  :key="trap.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ trap.name }} • {{ trap.severity }} • {{ trap.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('TRAP', trap.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'encounters'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="encounter in dungeon.map.encounters"
                  :key="encounter.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ encounter.title }} • {{ encounter.difficulty }} • {{ encounter.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('ENCOUNTER', encounter.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else-if="activeDetailsTab === 'treasure'" class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="treasure in dungeon.map.treasures"
                  :key="treasure.id"
                  class="rounded-md border border-default px-3 py-2"
                >
                  {{ treasure.category }} • {{ treasure.rarity }} • {{ treasure.isLocked ? 'Locked' : 'Unlocked' }}
                  <UButton size="xs" variant="ghost" class="ml-2" @click="toggleEntityLock('TREASURE', treasure.id)">Toggle lock</UButton>
                </div>
              </div>
              <div v-else class="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                <div
                  v-for="zone in dungeon.map.zones"
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
  </div>
</template>
