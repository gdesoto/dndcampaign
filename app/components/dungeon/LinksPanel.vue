<script setup lang="ts">
import type { DungeonLinkCreateInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonLink, CampaignDungeonRoom, DungeonLinkType, DungeonMapData } from '#shared/types/dungeon'

const props = defineProps<{
  campaignId: string
  links: CampaignDungeonLink[]
  rooms: CampaignDungeonRoom[]
  floorMap: DungeonMapData
  selectedRoomMetaId?: string
  busy: boolean
  canWrite: boolean
  creating: boolean
  deletingId?: string
}>()
const emit = defineEmits<{
  create: [input: DungeonLinkCreateInput]
  delete: [linkId: string]
}>()

type Target = { id: string; label: string; to?: string }
const linkTypes: Array<{ label: string; value: DungeonLinkType; icon: string; path: string }> = [
  { label: 'Quest', value: 'QUEST', icon: 'i-lucide-scroll', path: 'quests' },
  { label: 'Session', value: 'SESSION', icon: 'i-lucide-calendar-days', path: 'sessions' },
  { label: 'Milestone', value: 'MILESTONE', icon: 'i-lucide-flag', path: 'milestones' },
  { label: 'Glossary', value: 'GLOSSARY', icon: 'i-lucide-book-open', path: 'glossary' },
  { label: 'Encounter', value: 'ENCOUNTER', icon: 'i-lucide-swords', path: 'encounters' },
]

const { request } = useApi()
type TargetRecord = { id: string; title?: string; name?: string; sessionNumber?: number | null }
const { data: targets, pending, error, refresh } = await useLazyAsyncData(
  () => `dungeon-link-targets-${props.campaignId}`,
  async () => {
    const results = await Promise.allSettled(linkTypes.map(type =>
      request<TargetRecord[]>(`/api/campaigns/${props.campaignId}/${type.path}`)))
    if (results.every(result => result.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason
    return Object.fromEntries(linkTypes.map((type, index) => {
      const result = results[index]!
      const records = result.status === 'fulfilled' ? result.value ?? [] : []
      return [type.value, records.map((record): Target => ({
        id: record.id,
        label: type.value === 'SESSION' && record.sessionNumber ? `#${record.sessionNumber} · ${record.title}` : record.title || record.name || record.id,
        to: type.value === 'SESSION' ? `/campaigns/${props.campaignId}/sessions/${record.id}`
          : type.value === 'ENCOUNTER' ? `/campaigns/${props.campaignId}/encounters/${record.id}` : undefined,
      }))]
    })) as Record<DungeonLinkType, Target[]>
  },
  { server: false },
)

const newLink = reactive({ linkType: 'QUEST' as DungeonLinkType, targetId: '', roomId: '__map__' })
watch(() => newLink.linkType, () => { newLink.targetId = '' })
// Default new links to the room being inspected.
watch(() => props.selectedRoomMetaId, (id) => { newLink.roomId = id || '__map__' }, { immediate: true })
const targetItems = computed(() => (targets.value?.[newLink.linkType] ?? []).map(target => ({ label: target.label, value: target.id })))

const roomLabel = (room: CampaignDungeonRoom) => `${room.roomNumber} · ${room.name}`
const floorRooms = computed(() => props.rooms.filter(room => props.floorMap.rooms.some(mapRoom => mapRoom.roomNumber === room.roomNumber)))
const roomItems = computed(() => [{ label: 'Whole map', value: '__map__' }, ...floorRooms.value.map(room => ({ label: roomLabel(room), value: room.id }))])
const visibleLinks = computed(() => props.links.filter(link => !link.roomId || floorRooms.value.some(room => room.id === link.roomId)))

const describe = (link: CampaignDungeonLink) => {
  const type = linkTypes.find(item => item.value === link.linkType)!
  const target = targets.value?.[link.linkType]?.find(item => item.id === link.targetId)
  const room = link.roomId ? props.rooms.find(item => item.id === link.roomId) : undefined
  return {
    type,
    label: target?.label ?? (pending.value ? 'Loading…' : 'Missing record'),
    to: target?.to,
    room: room ? roomLabel(room) : 'Whole map',
  }
}

const submit = () => {
  if (!newLink.targetId) return
  emit('create', {
    linkType: newLink.linkType,
    targetId: newLink.targetId,
    roomId: newLink.roomId === '__map__' ? undefined : newLink.roomId,
  })
  newLink.targetId = ''
}
</script>

<template>
  <div class="space-y-4">
    <form v-if="canWrite" class="space-y-3" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-2">
        <UFormField label="Type">
          <USelect v-model="newLink.linkType" :items="linkTypes" aria-label="Link type" class="w-full" :disabled="busy" />
        </UFormField>
        <UFormField label="Applies to">
          <USelect v-model="newLink.roomId" :items="roomItems" aria-label="Link room" class="w-full" :disabled="busy" />
        </UFormField>
      </div>
      <UFormField :label="linkTypes.find(item => item.value === newLink.linkType)?.label">
        <USelectMenu
          v-model="newLink.targetId"
          :items="targetItems"
          value-key="value"
          :loading="pending"
          :disabled="busy"
          :placeholder="error ? 'Unable to load records' : 'Search…'"
          aria-label="Link target"
          class="w-full"
        />
      </UFormField>
      <div class="flex items-center gap-2">
        <UButton type="submit" size="sm" icon="i-lucide-link" :disabled="busy || !newLink.targetId" :loading="creating">Add link</UButton>
        <UButton v-if="error" size="sm" color="neutral" variant="ghost" @click="() => refresh()">Retry loading records</UButton>
      </div>
    </form>

    <p v-if="!visibleLinks.length" class="py-4 text-center text-sm text-muted">No links on this floor.</p>
    <ul v-else class="space-y-1.5">
      <li v-for="link in visibleLinks" :key="link.id" class="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm">
        <UIcon :name="describe(link).type.icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <ULink v-if="describe(link).to" :to="describe(link).to" class="block truncate font-medium hover:underline">{{ describe(link).label }}</ULink>
          <p v-else class="truncate font-medium">{{ describe(link).label }}</p>
          <p class="truncate text-xs text-muted">{{ describe(link).type.label }} · {{ describe(link).room }}</p>
        </div>
        <UButton
          v-if="canWrite"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-unlink"
          :aria-label="`Remove link to ${describe(link).label}`"
          :disabled="busy"
          :loading="deletingId === link.id"
          @click="emit('delete', link.id)"
        />
      </li>
    </ul>
  </div>
</template>
