<script setup lang="ts">
definePageMeta({ layout: 'default' })

type CharacterLink = {
  id: string
  status: 'ACTIVE' | 'INACTIVE'
  character: {
    id: string
    name: string
    canEdit: boolean
    isOwner: boolean
    summaryJson?: {
      level?: number
      classes?: string[]
      race?: string
    }
  }
  accessImpact?: {
    warningRequired: boolean
    impactedUserCount: number
  }
}

type CharacterOption = {
  id: string
  name: string
  canEdit: boolean
  isOwner: boolean
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const { data: links, pending, refresh, error } = await useAsyncData(
  () => `campaign-characters-${campaignId.value}`,
  () => request<CharacterLink[]>(`/api/campaigns/${campaignId.value}/characters`)
)

const { data: allCharacters } = await useAsyncData('all-characters', () =>
  request<CharacterOption[]>('/api/characters')
)

const attachCharacterId = ref('')
const attachError = ref('')

const attachCharacter = async () => {
  if (!canWriteContent.value) return
  if (!attachCharacterId.value) return
  attachError.value = ''
  try {
    await request(`/api/campaigns/${campaignId.value}/characters`, {
      method: 'POST',
      body: { characterId: attachCharacterId.value },
    })
    attachCharacterId.value = ''
    await refresh()
  } catch (error) {
    attachError.value =
      (error as Error & { message?: string }).message || 'Unable to attach character.'
  }
}

const updateStatus = async (link: CharacterLink, status: CharacterLink['status']) => {
  if (!canWriteContent.value) return
  await request(`/api/campaigns/${campaignId.value}/characters/${link.character.id}`, {
    method: 'PATCH',
    body: { status },
  })
  await refresh()
}

const removeLink = async (link: CharacterLink) => {
  if (!canWriteContent.value) return
  await request(`/api/campaigns/${campaignId.value}/characters/${link.character.id}`, {
    method: 'DELETE',
  })
  await refresh()
}

const removeLinkWithClose = async (link: CharacterLink, close: () => void) => {
  await removeLink(link)
  close()
}

const availableAttachCharacters = computed(() =>
  (allCharacters.value || []).filter((character) => character.canEdit)
)

const statusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
]
</script>

<template>
  <UPage>
    <div class="space-y-6">
      <UAlert
        v-if="!canWriteContent"
        color="warning"
        variant="subtle"
        title="Read-only access"
        description="Your role can view campaign characters but cannot attach, update, or remove links."
      />

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Campaign</p>
              <h1 class="mt-2 text-2xl font-semibold">Characters</h1>
              <p class="mt-2 text-sm text-muted">Manage which PCs are part of this campaign.</p>
            </div>
            <UButton variant="outline" :to="`/characters`">Open roster</UButton>
          </div>
        </template>
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <USelectMenu
              v-model="attachCharacterId"
              value-key="id"
              label-key="name"
              :items="availableAttachCharacters"
              placeholder="Attach existing character"
              class="min-w-[240px]"
              :disabled="!canWriteContent"
            />
            <UButton :disabled="!canWriteContent || !attachCharacterId" @click="attachCharacter">Attach</UButton>
            <UButton variant="outline" :to="`/characters`">Create or import</UButton>
          </div>
          <p v-if="attachError" class="text-sm text-error">{{ attachError }}</p>
        </div>
      </UCard>

      <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
        <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse" />
      </div>

      <UCard v-else-if="error" class="text-center">
        <p class="text-sm text-error">Unable to load campaign characters.</p>
        <UButton class="mt-4" variant="outline" @click="() => refresh()">Try again</UButton>
      </UCard>

      <UCard v-else-if="!links?.length" class="text-center">
        <p class="text-sm text-muted">No characters attached yet.</p>
        <UButton
          class="mt-4"
          variant="outline"
          :to="`/characters`"
          :disabled="!canWriteContent"
        >
          Add a character
        </UButton>
      </UCard>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <UCard v-for="link in links" :key="link.id">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">PC</p>
                <h3 class="text-lg font-semibold">{{ link.character.name }}</h3>
              </div>
              <UButton size="xs" variant="outline" :to="`/characters/${link.character.id}`">
                Open
              </UButton>
            </div>
          </template>
          <div class="space-y-2 text-sm">
            <p v-if="link.character.summaryJson?.classes?.length">
              Class: {{ link.character.summaryJson.classes.join(', ') }}
            </p>
            <p v-if="link.character.summaryJson?.level">Level: {{ link.character.summaryJson.level }}</p>
            <p v-if="link.character.summaryJson?.race">Race: {{ link.character.summaryJson.race }}</p>
          </div>
          <template #footer>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <USelect
                :items="statusOptions"
                :model-value="link.status"
                size="xs"
                :disabled="!canWriteContent"
                @update:model-value="(value) => updateStatus(link, value as CharacterLink['status'])"
              />
              <UPopover
                v-if="canWriteContent && link.character.isOwner"
                :content="{ side: 'top', align: 'end' }"
                :ui="{ content: 'w-72 p-3' }"
              >
                <UButton size="xs" color="error" variant="ghost">Remove</UButton>
                <template #content="{ close }">
                  <div class="space-y-3">
                    <p class="text-sm text-muted">
                      Remove {{ link.character.name }} from this campaign?
                    </p>
                    <UAlert
                      v-if="link.accessImpact?.warningRequired"
                      color="warning"
                      variant="subtle"
                      title="Shared access warning"
                      :description="`Up to ${link.accessImpact.impactedUserCount} non-owner member(s) may lose access to this character after removal.`"
                    />
                    <div class="flex justify-end gap-2">
                      <UButton size="xs" variant="ghost" color="neutral" @click="close">Cancel</UButton>
                      <UButton
                        size="xs"
                        color="error"
                        icon="i-lucide-trash-2"
                        @click="removeLinkWithClose(link, close)"
                      >
                        Remove
                      </UButton>
                    </div>
                  </div>
                </template>
              </UPopover>
              <UTooltip v-else-if="canWriteContent && !link.character.isOwner" text="Only the character owner can remove this link.">
                <UButton size="xs" color="error" variant="ghost" disabled>Remove</UButton>
              </UTooltip>
              <UButton v-else size="xs" color="error" variant="ghost" disabled>Remove</UButton>
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </UPage>
</template>

