<script setup lang="ts">
definePageMeta({ layout: 'app' })

type SessionItem = {
  id: string
  title: string
}

type GlossaryLink = {
  id: string
  sessionId: string
  session: SessionItem
}

type CharacterLink = {
  id: string
  character: {
    id: string
    name: string
  }
}

type GlossaryEntry = {
  id: string
  type: 'PC' | 'NPC' | 'ITEM' | 'LOCATION'
  name: string
  aliases?: string | null
  description: string
  sessions: GlossaryLink[]
  campaignCharacters?: CharacterLink[]
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

const types = [
  { label: 'PCs', value: 'PC' },
  { label: 'NPCs', value: 'NPC' },
  { label: 'Items', value: 'ITEM' },
  { label: 'Locations', value: 'LOCATION' },
]

const activeType = ref<'PC' | 'NPC' | 'ITEM' | 'LOCATION'>('PC')
const search = ref('')

const { data: sessions } = await useAsyncData(
  () => `glossary-sessions-${campaignId.value}`,
  () => request<SessionItem[]>(`/api/campaigns/${campaignId.value}/sessions`)
)

const { data: entries, pending, refresh, error } = await useAsyncData(
  () => `glossary-${campaignId.value}-${activeType.value}-${search.value}`,
  () =>
    request<GlossaryEntry[]>(
      `/api/campaigns/${campaignId.value}/glossary?type=${activeType.value}&search=${encodeURIComponent(
        search.value
      )}`
    ),
  { watch: [activeType, search] }
)

const isEditOpen = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: '',
  type: activeType.value,
  name: '',
  aliases: '',
  description: '',
})
const editError = ref('')
const isSaving = ref(false)

const openCreate = () => {
  editMode.value = 'create'
  editError.value = ''
  editForm.id = ''
  editForm.type = activeType.value
  editForm.name = ''
  editForm.aliases = ''
  editForm.description = ''
  isEditOpen.value = true
}

const openEdit = (entry: GlossaryEntry) => {
  editMode.value = 'edit'
  editError.value = ''
  editForm.id = entry.id
  editForm.type = entry.type
  editForm.name = entry.name
  editForm.aliases = entry.aliases || ''
  editForm.description = entry.description
  isEditOpen.value = true
}

const saveEntry = async () => {
  editError.value = ''
  isSaving.value = true
  try {
    if (editMode.value === 'create') {
      await request(`/api/campaigns/${campaignId.value}/glossary`, {
        method: 'POST',
        body: {
          type: editForm.type,
          name: editForm.name,
          aliases: editForm.aliases || undefined,
          description: editForm.description,
        },
      })
    } else {
      await request(`/api/glossary/${editForm.id}`, {
        method: 'PATCH',
        body: {
          type: editForm.type,
          name: editForm.name,
          aliases: editForm.aliases || null,
          description: editForm.description,
        },
      })
    }
    isEditOpen.value = false
    await refresh()
  } catch (error) {
    editError.value =
      (error as Error & { message?: string }).message || 'Unable to save glossary entry.'
  } finally {
    isSaving.value = false
  }
}

const deleteEntry = async (entry: GlossaryEntry) => {
  await request(`/api/glossary/${entry.id}`, { method: 'DELETE' })
  await refresh()
}

const linkSession = async (entry: GlossaryEntry, sessionId: string) => {
  if (!sessionId) return
  await request(`/api/glossary/${entry.id}/sessions/${sessionId}`, { method: 'POST' })
  await refresh()
}

const unlinkSession = async (entry: GlossaryEntry, sessionId: string) => {
  await request(`/api/glossary/${entry.id}/sessions/${sessionId}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Glossary</p>
        <h1 class="mt-2 text-2xl font-semibold">World index</h1>
      </div>
      <UButton size="lg" @click="openCreate">New entry</UButton>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex gap-2">
        <UButton
          v-for="type in types"
          :key="type.value"
          size="sm"
          :variant="activeType === type.value ? 'solid' : 'outline'"
          @click="activeType = type.value as typeof activeType"
        >
          {{ type.label }}
        </UButton>
      </div>
      <UInput v-model="search" placeholder="Search names, aliases, description..." class="min-w-[240px]" />
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="i in 3" :key="i"  class="h-32 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load glossary entries.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <UCard v-else-if="!entries?.length" class="text-center">
      <p class="text-sm text-muted">No entries yet.</p>
      <UButton class="mt-4" variant="outline" @click="openCreate">Create your first entry</UButton>
    </UCard>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="entry in entries"
        :key="entry.id"
        
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ entry.type }}</p>
              <h3 class="text-lg font-semibold">{{ entry.name }}</h3>
              <p v-if="entry.aliases" class="text-xs text-muted">Aliases: {{ entry.aliases }}</p>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="entry.type === 'PC' && entry.campaignCharacters?.length"
                size="xs"
                variant="outline"
                :to="`/characters/${entry.campaignCharacters[0].character.id}`"
              >
                View character
              </UButton>
              <UButton size="xs" variant="outline" @click="openEdit(entry)">Edit</UButton>
              <UButton size="xs" color="red" variant="ghost" @click="deleteEntry(entry)">Delete</UButton>
            </div>
          </div>
        </template>
        <p class="text-sm text-default">{{ entry.description }}</p>
        <div class="mt-4 space-y-2">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Linked sessions</p>
          <div v-if="entry.sessions.length" class="flex flex-wrap gap-2">
            <UButton
              v-for="link in entry.sessions"
              :key="link.id"
              size="xs"
              variant="outline"
              @click="unlinkSession(entry, link.sessionId)"
            >
              {{ link.session.title }}
            </UButton>
          </div>
          <div v-else class="text-xs text-muted">No sessions linked yet.</div>
          <div class="flex gap-2">
            <USelect
              :items="(sessions || []).map((session) => ({ label: session.title, value: session.id }))"
              placeholder="Link a session..."
              :model-value="''"
              @update:model-value="(value) => linkSession(entry, value as string)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #title>
        <span class="sr-only">
          {{ editMode === 'create' ? 'Create glossary entry' : 'Edit glossary entry' }}
        </span>
      </template>
      <template #description>
        <span class="sr-only">Manage glossary entry details for this campaign.</span>
      </template>
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">
              {{ editMode === 'create' ? 'Create glossary entry' : 'Edit glossary entry' }}
            </h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Type</label>
              <USelect v-model="editForm.type" :items="types" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Name</label>
              <UInput v-model="editForm.name" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Aliases</label>
              <UInput v-model="editForm.aliases" placeholder="Comma-separated" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Description</label>
              <UTextarea v-model="editForm.description" :rows="6" />
            </div>
            <p v-if="editError" class="text-sm text-error">{{ editError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isEditOpen = false">Cancel</UButton>
              <UButton :loading="isSaving" @click="saveEntry">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
