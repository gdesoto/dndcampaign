<script setup lang="ts">
const props = defineProps<{ campaignId: string }>()
const { request } = useApi()

type PartyCharacterLink = {
  status: 'ACTIVE' | 'INACTIVE'
  character: {
    id: string
    name: string
    summaryJson?: { portraitUrl?: string } | null
  }
}

// Share the roster key so attaching, removing, or retiring a character refreshes this summary.
const { data: links, pending, error, refresh } = await useAsyncData(
  () => `campaign-characters-${props.campaignId}`,
  () => request<PartyCharacterLink[]>(`/api/campaigns/${props.campaignId}/characters`),
)

const party = computed(() => (links.value || [])
  .filter(link => link.status === 'ACTIVE')
  .map(link => link.character)
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)))
const visibleParty = computed(() => party.value.slice(0, 4))
const charactersPath = computed(() => `/campaigns/${props.campaignId}/characters`)
</script>

<template>
  <section class="flex min-h-11 w-full min-w-0 items-center justify-between gap-2" aria-label="Campaign party" :aria-busy="pending">
    <p class="type-label shrink-0 text-muted">Party</p>

    <p v-if="pending && !links" role="status" class="text-sm text-muted">Loading…</p>
    <div v-else-if="error" class="flex items-center gap-1">
      <p role="status" class="text-xs text-muted">Unavailable</p>
      <UButton label="Retry" aria-label="Retry loading party" color="neutral" variant="ghost" size="md" :loading="pending" @click="refresh()" />
    </div>
    <div v-else-if="party.length" class="flex shrink-0 items-center">
      <div class="isolate flex -space-x-2 items-center">
        <UTooltip v-for="character in visibleParty" :key="character.id" :text="character.name">
          <NuxtLink
            :to="`/characters/${character.id}`"
            :aria-label="`View ${character.name}`"
            class="relative flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ring-bg hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UAvatar :src="character.summaryJson?.portraitUrl" :alt="character.name" size="md" />
          </NuxtLink>
        </UTooltip>
      </div>
      <UButton
        v-if="party.length > visibleParty.length"
        :to="charactersPath"
        :label="`+${party.length - visibleParty.length}`"
        :aria-label="`View all ${party.length} active characters`"
        color="neutral"
        variant="ghost"
        size="md"
        class="ms-1"
      />
    </div>
    <p v-else class="text-xs text-muted">No active characters</p>
  </section>
</template>
