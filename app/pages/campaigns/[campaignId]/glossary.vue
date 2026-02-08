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

    <SharedResourceState
      :pending="pending"
      :error="error"
      :empty="!entries?.length"
      error-message="Unable to load glossary entries."
      empty-message="No entries yet."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse" />
        </div>
      </template>
      <template #emptyActions>
        <UButton variant="outline" @click="openCreate">Create your first entry</UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <SharedListItemCard
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
        </SharedListItemCard>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      :title="editMode === 'create' ? 'Create glossary entry' : 'Edit glossary entry'"
      description="Manage glossary entry details for this campaign."
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      @submit="saveEntry"
    >
      <UFormField label="Type" name="type">
        <USelect v-model="editForm.type" :items="types" />
      </UFormField>
      <UFormField label="Name" name="name">
        <UInput v-model="editForm.name" />
      </UFormField>
      <UFormField label="Aliases" name="aliases">
        <UInput v-model="editForm.aliases" placeholder="Comma-separated" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="editForm.description" :rows="6" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>
