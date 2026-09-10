<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
import CharacterClassAvatar from '~/components/character/ClassAvatar.vue'
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
        str?: number | { total?: number; base?: number }
        dex?: number | { total?: number; base?: number }
        con?: number | { total?: number; base?: number }
        int?: number | { total?: number; base?: number }
        wis?: number | { total?: number; base?: number }
        cha?: number | { total?: number; base?: number }
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

const { data: allCharacters, pending: rosterPending, error: rosterError, refresh: refreshRoster } = await useAsyncData('all-characters', () =>
  request<CharacterOption[]>('/api/characters')
)

const attachCharacterId = ref('')
const attachError = ref('')
const attaching = ref(false)

const attachCharacter = async () => {
  if (!canWriteContent.value || attaching.value) return
  if (!attachCharacterId.value) return
  attachError.value = ''
  attaching.value = true
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
  } finally { attaching.value = false }
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
  (allCharacters.value || []).filter((character) => character.canEdit && !links.value?.some(link => link.character.id === character.id))
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
  return race || classes || ''
}

const ownerLineFor = (link: CharacterLink) => {
  const playerName = link.character.sheetJson?.basics?.playerName
  return playerName ? `Played by ${playerName}` : ''
}

const abilityScoreFor = (link: CharacterLink, key: AbilityKey) => {
  return characterAbilityScore(link.character.sheetJson?.abilityScores?.[key])
}

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
  <CampaignListTemplate title="Characters" :count="links?.length">
    <template #actions>
      <UButton to="/characters" icon="i-lucide-users" variant="outline">Character roster</UButton>
    </template>
    <template #notice>
      <SharedReadOnlyAlert v-if="!canWriteContent" description="Your role can view campaign characters but cannot attach, update, or remove links." />
    </template>
    <UCard v-if="canWriteContent" variant="soft" class="bg-muted">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Add from your roster" name="character" class="w-full sm:w-80">
          <USelectMenu v-model="attachCharacterId" value-key="id" label-key="name" :items="availableAttachCharacters" placeholder="Select character" class="w-full" :loading="rosterPending" :disabled="attaching || rosterPending" />
        </UFormField>
        <UButton icon="i-lucide-user-plus" color="primary" variant="solid" :disabled="!attachCharacterId || attaching" :loading="attaching" @click="attachCharacter">Add to campaign</UButton>
      </div>
      <p v-if="attachError" role="alert" class="mt-2 text-sm text-error">{{ attachError }}</p>
      <div v-if="rosterError" role="alert" class="mt-2 flex items-center gap-2 text-sm text-error">
        Unable to load your roster. <UButton variant="ghost" @click="refreshRoster()">Retry</UButton>
      </div>
      <p v-else-if="!rosterPending && !availableAttachCharacters.length" class="mt-2 text-sm text-muted">No more characters available. <NuxtLink to="/characters" class="underline">Create or import in your roster.</NuxtLink></p>
    </UCard>
    <SharedResourceState :pending="pending" :error="error" :has-data="Boolean(links)" :empty="!links?.length" empty-message="No characters attached yet." error-message="Unable to load campaign characters." @retry="refresh()">
      <template #loading><div class="grid gap-4 md:grid-cols-2"><USkeleton v-for="i in 2" :key="i" class="h-80" /></div></template>
      <div v-if="links?.length" class="grid gap-4 md:grid-cols-2">
        <UCard
          v-for="link in links"
          :key="link.id"
        >
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <CharacterClassAvatar
                  :src="link.character.summaryJson?.portraitUrl"
                  :name="link.character.name"
                  :classes="link.character.summaryJson?.classes"
                  :level="link.character.summaryJson?.level"
                />
                <div class="min-w-0 space-y-1">
                  <h2 class="uppercase text-highlighted type-record">
                    <NuxtLink :to="`/characters/${link.character.id}`" class="break-words hover:underline">{{ link.character.name }}</NuxtLink>
                  </h2>
                  <p v-if="subtitleFor(link)" class="text-sm italic text-muted">{{ subtitleFor(link) }}</p>
                  <p v-if="ownerLineFor(link)" class="text-xs text-muted">{{ ownerLineFor(link) }}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UBadge :color="link.status === 'ACTIVE' ? 'success' : 'neutral'" variant="outline">{{ link.status === 'ACTIVE' ? 'Active' : 'Inactive' }}</UBadge>
                <SharedActionMenu :name="link.character.name" :items="characterActions(link)" />
              </div>
            </div>

            <div class="space-y-2">
              <CharacterHitPoints :name="link.character.name" :current="hpFor(link)" :max="link.character.sheetJson?.hitPoints?.max" />
              <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <p class="flex items-center gap-2"><UIcon name="i-lucide-shield" aria-hidden="true" /> AC <span class="tabular-nums text-highlighted">{{ acFor(link) ?? '—' }}</span></p>
                <p class="flex items-center gap-2"><UIcon name="i-lucide-zap" aria-hidden="true" /> Initiative <span class="tabular-nums text-highlighted">{{ initiativeFor(link) ?? '—' }}</span></p>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 xl:grid-cols-6">
              <CharacterAbilityStat
                v-for="ability in abilityOrder"
                :key="ability.key"
                :label="ability.label"
                :score="abilityScoreFor(link, ability.key)"
                :modifier="abilityModFor(abilityScoreFor(link, ability.key))"
                compact
              />
            </div>
          </div>

        </UCard>
      </div>
    </SharedResourceState>
  </CampaignListTemplate>
</template>
