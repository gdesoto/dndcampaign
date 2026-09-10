<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { namedEntityFormSchema } from '~/utils/entity-form-schemas'
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

const deletingEntryId = ref<string | null>(null)

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
  deletingEntryId.value = entry.id
  try {
    await request(`/api/glossary/${entry.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingEntryId.value = null
  }
}

const deleteEditingEntry = async () => {
  if (editMode.value !== 'edit') return
  const entry = (entries.value || []).find((item) => item.id === editForm.id)
  if (!entry) return

  await deleteEntry(entry)
  isEditOpen.value = false
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
const toast = useToast()
const entryActions = (entry: GlossaryEntry): RecordAction[] => [
  ...(entry.type === 'PC' && entry.campaignCharacters?.[0] ? [{ label: 'Open character sheet', icon: 'i-lucide-user', to: `/characters/${entry.campaignCharacters[0].character.id}` }] : []),
  ...(canWriteContent.value ? [
    { label: 'Edit', icon: 'i-lucide-pencil', action: () => openEdit(entry) },
    { label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => deleteEntry(entry), confirmation: { message: `Delete ${entry.name}? This cannot be undone.` } },
  ] : []),
]
const sessionActions = (entry: GlossaryEntry, link: GlossaryLink): RecordAction[] => canWriteContent.value ? [{
  label: 'Unlink session', icon: 'i-lucide-unlink', action: async () => {
    await unlinkSession(entry, link.sessionId)
    toast.add({ title: 'Session unlinked', actions: [{ label: 'Undo', onClick: async () => {
      try { await linkSession(entry, link.sessionId) }
      catch { toast.add({ title: 'Unable to restore session link', color: 'error' }) }
    } }] })
  },
}] : []
</script>

<template>
  <div class="space-y-6">
    <CampaignListTemplate
      title="Glossary"
      :count="entries?.length"
      :action-label="canWriteContent ? 'New entry' : ''"
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
        <UCard class="bg-muted">
          <SharedFilterToolbar label="Filter glossary">
            <UFormField label="Search glossary" name="glossarySearch">
              <UInput v-model="search" placeholder="Name, alias, or description" icon="i-lucide-search" class="w-full" />
            </UFormField>
            <UFormField label="Type" name="glossaryType">
              <USelect v-model="activeType" :items="types" class="w-full" />
            </UFormField>
          </SharedFilterToolbar>
        </UCard>
      </template>

      <SharedResourceState
        :has-data="Boolean(entries)"
        :pending="pending"
        :error="error"
        :empty="!entries?.length"
        error-message="Unable to load glossary entries."
        empty-message="No entries of this type yet."
        :no-matches="Boolean(search)"
        @clear="search = ''"
        @retry="refresh"
      >
        <template #loading>
          <div class="grid gap-4 sm:grid-cols-2">
            <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse" />
          </div>
        </template>
        <template #emptyActions>
          <UButton v-if="canWriteContent" icon="i-lucide-plus" variant="outline" @click="openCreate">Create your first entry</UButton>
        </template>

        <div class="grid gap-4 sm:grid-cols-2">
          <SharedListItemCard
            v-for="entry in entries"
            :key="entry.id"
          >
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <UAvatar v-if="entry.type === 'PC' || entry.type === 'NPC'" :alt="entry.name" size="md" />
                  <UIcon v-else :name="entry.type === 'LOCATION' ? 'i-lucide-map-pin' : 'i-lucide-gem'" class="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
                  <div class="min-w-0">
                  <h2 class="type-record break-words">{{ entry.name }}</h2>
                  <p v-if="entry.aliases" class="text-xs text-muted">Aliases: {{ entry.aliases }}</p>
                  </div>
                </div>
                <SharedActionMenu :name="entry.name" :items="entryActions(entry)" />
              </div>
            </template>
            <p v-if="entry.description" class="reading-copy whitespace-pre-line text-default">{{ entry.description }}</p>
            <div v-if="entry.sessions.length || canWriteContent" class="mt-4 space-y-2">
              <p class="text-xs uppercase tracking-[0.08em] text-dimmed">Linked sessions</p>
              <div v-if="entry.sessions.length" class="flex flex-wrap gap-2">
                <div v-for="link in entry.sessions" :key="link.id" class="flex items-center gap-1">
                  <NuxtLink :to="`/campaigns/${campaignId}/sessions/${link.sessionId}`" class="text-sm text-primary hover:underline">{{ link.session.title }}</NuxtLink>
                  <SharedActionMenu :name="link.session.title" :items="sessionActions(entry, link)" />
                </div>
              </div>
              <div v-if="canWriteContent" class="flex gap-2">
                <USelect
                  :aria-label="`Link a session to ${entry.name}`"
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
:schema="namedEntityFormSchema"
      :state="editForm"
      :title="editMode === 'create' ? 'Create glossary entry' : 'Edit glossary entry'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      :show-delete-action="editMode === 'edit'"
      :delete-loading="deletingEntryId === editForm.id"
      :delete-action="deleteEditingEntry"
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


