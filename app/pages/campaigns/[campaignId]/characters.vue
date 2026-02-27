<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

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
      hp?: number
      ac?: number
      passivePerception?: number
      portraitUrl?: string
    }
    sheetJson?: {
      basics?: {
        playerName?: string
      }
      abilityScores?: {
        str?: number
        dex?: number
        con?: number
        int?: number
        wis?: number
        cha?: number
      }
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

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

const abilityOrder: Array<{ key: AbilityKey, label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

const subtitleFor = (link: CharacterLink) => {
  const race = link.character.summaryJson?.race
  const classes = link.character.summaryJson?.classes?.join(' · ')
  if (race && classes) return `${race} · ${classes}`
  return race || classes || 'Adventurer'
}

const ownerLineFor = (link: CharacterLink) => {
  const playerName = link.character.sheetJson?.basics?.playerName
  return playerName ? `Played by ${playerName}` : 'Campaign character'
}

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

const abilityScoreFor = (link: CharacterLink, key: AbilityKey) =>
  link.character.sheetJson?.abilityScores?.[key]

const abilityModFor = (score?: number) => {
  if (typeof score !== 'number') return null
  const modifier = Math.floor((score - 10) / 2)
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}

const hpFor = (link: CharacterLink) => link.character.summaryJson?.hp
const acFor = (link: CharacterLink) => link.character.summaryJson?.ac
const initiativeFor = (link: CharacterLink) => {
  const dex = abilityScoreFor(link, 'dex')
  if (typeof dex !== 'number') return null
  const modifier = Math.floor((dex - 10) / 2)
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}
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
        <UCard
          v-for="link in links"
          :key="link.id"
          :ui="{
            root: 'overflow-hidden',
            header: 'before:block before:h-[4px] before:bg-gradient-to-r before:from-primary-700 before:via-primary-500 before:to-primary-700',
          }"
        >
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <UAvatar
                  :src="link.character.summaryJson?.portraitUrl"
                  :alt="link.character.name"
                  size="xl"
                  :text="initialsFor(link.character.name)"
                  class="border border-[var(--ui-border-accented)]/70"
                />
                <div class="space-y-1">
                  <h3 class="font-display text-lg tracking-[0.02em] uppercase text-[var(--ui-text-highlighted)]">
                    {{ link.character.name }}
                  </h3>
                  <p class="text-sm italic text-[var(--ui-text-muted)]">{{ subtitleFor(link) }}</p>
                  <p class="text-xs text-[var(--ui-text-dimmed)]">{{ ownerLineFor(link) }}</p>
                  <div class="flex flex-wrap items-center gap-2 pt-1">
                    <UBadge
                      :color="link.status === 'ACTIVE' ? 'primary' : 'neutral'"
                      variant="outline"
                    >
                      {{ link.status === 'ACTIVE' ? 'Active' : 'Inactive' }}
                    </UBadge>
                    <UBadge
                      v-if="link.character.summaryJson?.level"
                      color="neutral"
                      variant="outline"
                    >
                      Level {{ link.character.summaryJson.level }}
                    </UBadge>
                  </div>
                </div>
              </div>
              <UButton
                size="xs"
                variant="outline"
                icon="i-lucide-star"
                :to="`/characters/${link.character.id}`"
                aria-label="Open character sheet"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-end justify-between gap-2">
                <p class="font-display text-[10px] uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">
                  Hit Points
                </p>
                <p class="font-display text-sm text-[var(--ui-text-highlighted)]">
                  {{ hpFor(link) ?? '—' }}
                </p>
              </div>
              <div class="h-2 rounded-sm border border-[var(--ui-border)] bg-[var(--ui-bg-muted)]/60 p-[1px]">
                <div
                  class="h-full rounded-[2px] bg-success-500/80"
                  :style="{ width: typeof hpFor(link) === 'number' ? '100%' : '35%' }"
                />
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ui-text-muted)]">
                <p>AC {{ acFor(link) ?? '—' }}</p>
                <p>Initiative {{ initiativeFor(link) ?? '—' }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <div
                v-for="ability in abilityOrder"
                :key="ability.key"
                class="rounded border border-[var(--ui-border)] bg-[var(--ui-bg-accented)]/45 px-2 py-2 text-center"
              >
                <p class="font-display text-[11px] text-[var(--ui-text-highlighted)]">
                  {{ abilityScoreFor(link, ability.key) ?? '—' }}
                </p>
                <p class="text-[11px] text-primary-500">{{ abilityModFor(abilityScoreFor(link, ability.key)) ?? '—' }}</p>
                <p class="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-text-dimmed)]">{{ ability.label }}</p>
              </div>
            </div>
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
              <SharedConfirmActionPopover
                v-if="canWriteContent && link.character.isOwner"
                message="Remove character link?"
                content-class="w-72 p-3"
                confirm-label="Remove"
                confirm-icon="i-lucide-trash-2"
                @confirm="({ close }) => removeLinkWithClose(link, close)"
              >
                <template #trigger>
                  <UButton size="xs" color="error" variant="ghost">Remove</UButton>
                </template>
                <template #content>
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
                  </div>
                </template>
              </SharedConfirmActionPopover>
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


