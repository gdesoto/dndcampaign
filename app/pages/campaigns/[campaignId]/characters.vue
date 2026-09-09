<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
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
      hitPoints?: { current?: number; max?: number }
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

const { campaignId, request, canWriteContent } = useCampaignPageContext()

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



const availableAttachCharacters = computed(() =>
  (allCharacters.value || []).filter((character) => character.canEdit)
)



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

const hpFor = (link: CharacterLink) => link.character.sheetJson?.hitPoints?.current ?? link.character.summaryJson?.hp
const acFor = (link: CharacterLink) => link.character.summaryJson?.ac
const initiativeFor = (link: CharacterLink) => {
  const dex = abilityScoreFor(link, 'dex')
  if (typeof dex !== 'number') return null
  const modifier = Math.floor((dex - 10) / 2)
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}
const toast = useToast()
const changeStatus = async (link: CharacterLink) => {
  const previous = link.status
  const targetCampaignId = campaignId.value
  await updateStatus(link, previous === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
  toast.add({ title: 'Character status updated', actions: [{ label: 'Undo', onClick: async () => {
    try {
      await request(`/api/campaigns/${targetCampaignId}/characters/${link.character.id}`, { method: 'PATCH', body: { status: previous } })
      if (campaignId.value === targetCampaignId) await refresh()
    }
    catch { toast.add({ title: 'Unable to restore character status', color: 'error' }) }
  } }] })
}
const characterActions = (link: CharacterLink): RecordAction[] => [
  { label: 'Open character sheet', icon: 'i-lucide-user', to: `/characters/${link.character.id}` },
  ...(canWriteContent.value ? [
    { label: link.status === 'ACTIVE' ? 'Mark inactive' : 'Mark active', icon: 'i-lucide-circle-check', action: () => changeStatus(link) },
    { label: 'Remove from campaign', icon: 'i-lucide-unlink', destructive: true, disabled: !link.character.isOwner, description: !link.character.isOwner ? 'Only the character owner can remove this link.' : undefined, action: () => removeLink(link), confirmation: { label: 'Remove', modal: Boolean(link.accessImpact?.warningRequired), message: `Remove ${link.character.name} from this campaign? The character itself will remain.${link.accessImpact?.warningRequired ? ` Up to ${link.accessImpact.impactedUserCount} non-owner members may lose access to this character.` : ''}` } },
  ] : []),
]
</script>

<template>
  <UPage>
    <div class="space-y-6">
      <SharedReadOnlyAlert
        v-if="!canWriteContent"
        description="Your role can view campaign characters but cannot attach, update, or remove links."
      />

      <UPageHeader
        headline="Campaign"
        title="Characters"
        description="Manage which PCs are part of this campaign."
      >
        <template #links>
          <UButton variant="outline" :to="`/characters`">Open roster</UButton>
        </template>
      </UPageHeader>

      <UCard>
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
                    <NuxtLink :to="`/characters/${link.character.id}`" class="hover:underline">{{ link.character.name }}</NuxtLink>
                  </h3>
                  <p class="text-sm italic text-[var(--ui-text-muted)]">{{ subtitleFor(link) }}</p>
                  <p class="text-xs text-[var(--ui-text-muted)]">{{ ownerLineFor(link) }}</p>
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
              <SharedActionMenu :name="link.character.name" :items="characterActions(link)" />
            </div>

            <div class="space-y-2">
              <CharacterHitPoints :name="link.character.name" :current="hpFor(link)" :max="link.character.sheetJson?.hitPoints?.max" />
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
                <p class="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">{{ ability.label }}</p>
              </div>
            </div>
          </div>

        </UCard>
      </div>
    </div>
  </UPage>
</template>



