<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
definePageMeta({ layout: 'dashboard' })

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

const { campaignId, request, canWriteContent } = useCampaignPageContext()

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

const isInitialEntriesLoadPending = computed(() => pending.value && !entries.value)

const {
  isOpen: isEditOpen,
  mode: editMode,
  form: editForm,
  error: editError,
  isSaving,
  openCreate: openGlossaryCreate,
  openEdit: openGlossaryEdit,
  saveWith: saveGlossaryWith,
} = useCrudModal(() => ({
  id: '',
  type: activeType.value,
  name: '',
  aliases: '',
  description: '',
}))

const openCreate = () => {
  if (!canWriteContent.value) return
  openGlossaryCreate({
    type: activeType.value,
  })
}

const openEdit = (entry: GlossaryEntry) => {
  if (!canWriteContent.value) return
  openGlossaryEdit({
    id: entry.id,
    type: entry.type,
    name: entry.name,
    aliases: entry.aliases || '',
    description: entry.description,
  })
}

const saveEntry = async () => {
  if (!canWriteContent.value) return
  await saveGlossaryWith(async ({ mode, form }) => {
    if (mode === 'create') {
      await request(`/api/campaigns/${campaignId.value}/glossary`, {
        method: 'POST',
        body: {
          type: form.type,
          name: form.name,
          aliases: form.aliases || undefined,
          description: form.description,
        },
      })
    } else {
      await request(`/api/glossary/${form.id}`, {
        method: 'PATCH',
        body: {
          type: form.type,
          name: form.name,
          aliases: form.aliases || null,
          description: form.description,
        },
      })
    }
    await refresh()
  }, 'Unable to save glossary entry.')
}

const deleteEntry = async (entry: GlossaryEntry) => {
  if (!canWriteContent.value) return
  await request(`/api/glossary/${entry.id}`, { method: 'DELETE' })
  await refresh()
}

const linkSession = async (entry: GlossaryEntry, sessionId: string) => {
  if (!canWriteContent.value) return
  if (!sessionId) return
  await request(`/api/glossary/${entry.id}/sessions/${sessionId}`, { method: 'POST' })
  await refresh()
}

const unlinkSession = async (entry: GlossaryEntry, sessionId: string) => {
  if (!canWriteContent.value) return
  await request(`/api/glossary/${entry.id}/sessions/${sessionId}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <CampaignListTemplate
      headline="Glossary"
      title="World index"
      description="Track campaign entities, aliases, and linked sessions."
      action-label="New entry"
      action-icon="i-lucide-plus"
      :action-disabled="!canWriteContent"
      @action="openCreate"
    >
      <template #notice>
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can view glossary entries but cannot edit them."
        />
      </template>

      <template #filters>
        <UCard>
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
        </UCard>
      </template>

      <SharedResourceState
        :pending="isInitialEntriesLoadPending"
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
          <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first entry</UButton>
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
                    :to="`/characters/${entry.campaignCharacters?.[0]?.character.id || ''}`"
                  >
                    View character
                  </UButton>
                  <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="openEdit(entry)">Edit</UButton>
                  <UButton size="xs" color="error" variant="ghost" :disabled="!canWriteContent" @click="deleteEntry(entry)">Delete</UButton>
                </div>
              </div>
            </template>
            <p class="text-sm whitespace-pre-line text-default">{{ entry.description }}</p>
            <div class="mt-4 space-y-2">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Linked sessions</p>
              <div v-if="entry.sessions.length" class="flex flex-wrap gap-2">
                <UButton
                  v-for="link in entry.sessions"
                  :key="link.id"
                  size="xs"
                  variant="outline"
                  :disabled="!canWriteContent"
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
                  :disabled="!canWriteContent"
                  :model-value="''"
                  @update:model-value="(value) => linkSession(entry, value as string)"
                />
              </div>
            </div>
          </SharedListItemCard>
        </div>
      </SharedResourceState>
    </CampaignListTemplate>

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


