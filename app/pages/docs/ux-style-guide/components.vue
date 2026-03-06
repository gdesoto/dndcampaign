<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { SessionPanel } from '~/composables/useUxStyleGuideContent'

definePageMeta({ layout: 'docs' })

const {
  trackerExamples,
  npcExamples,
  characterStats,
  playerNotes,
  questColumns,
  questRows,
  sessionTabs,
  sessionPanels,
} = useUxStyleGuideContent()

const activeSessionTab = ref<string | number>('summary')
const defaultSessionPanel: SessionPanel = {
  title: 'Session Summary',
  description: 'Lead with the current state of play, not every artifact attached to the session.',
  bullets: [
    'Put the recap, unresolved hooks, and next-scene prep first.',
    'Show only the most relevant quest and NPC links at this layer.',
    'Hide transcripts and exports behind deeper views.',
  ],
}
const activeSessionPanel = computed<SessionPanel>(() => sessionPanels[String(activeSessionTab.value)] ?? defaultSessionPanel)
const isQuestModalOpen = ref(false)
const isRitualAlertOpen = ref(true)

const npcAvatarIcons: Record<string, string> = {
  'Captain Mirel': 'i-twemoji-crossed-swords',
  'Seraphine Vale': 'i-twemoji-crystal-ball',
  'Tallow Venn': 'i-twemoji-compass',
}

const avatarIconForNpc = (name: string) => npcAvatarIcons[name] ?? 'i-twemoji-bust-in-silhouette'
const semanticColors = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
const buttonVariants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const
const badgeVariants = ['solid', 'outline', 'soft', 'subtle'] as const
const controlSizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const
const labelize = (token: string) => `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`
const alertActions: ButtonProps[] = [
  { label: 'Open prep', icon: 'i-lucide-scroll-text', variant: 'soft', color: 'warning' as const },
  { label: 'Pin threat', icon: 'i-lucide-pin', variant: 'ghost', color: 'neutral' as const },
]
</script>

<template>
  <UPage>
    <UPageHeader
      title="Components"
      headline="UX Style Guide"
      description="Nuxt UI patterns for campaign objects, page regions, workflows, tabs, data tables, and fast-capture controls."
    />

    <UPageBody class="space-y-6">
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Quest tracker cards</h2>
            <p class="text-sm text-muted">{{ trackerExamples[0]?.summary }}</p>
          </div>
        </template>

        <div class="grid gap-3 lg:grid-cols-2">
          <UCard class="self-start">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-display text-base text-highlighted">Recover the Moonstone Lens</h3>
                <UBadge color="success" variant="outline" label="Active" />
              </div>
            </template>
            <p class="text-sm leading-6 text-muted">Patron: Seraphine • Next hook: open the sealed observatory.</p>
            <template #footer>
              <UButton size="sm" variant="solid">Open quest</UButton>
            </template>
          </UCard>

          <div class="grid gap-3">
            <UCard class="self-start">
              <template #header>
                <h3 class="font-display text-base text-highlighted">Current Arc</h3>
              </template>
              <p class="text-sm leading-6 text-muted">The bells wake what the city buried.</p>
            </UCard>
            <UCard class="self-start">
              <template #header>
                <h3 class="font-display text-base text-highlighted">Session Prep</h3>
              </template>
              <ul class="space-y-2 text-sm leading-6 text-muted">
                <li>Flooded chapel reveal</li>
                <li>Mirel confrontation notes</li>
                <li>Ritual clock timing</li>
              </ul>
            </UCard>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="space-y-1">
            <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">NPC directory cards</h2>
            <p class="text-sm text-muted">{{ trackerExamples[1]?.summary }}</p>
          </div>
        </template>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="npc in npcExamples" :key="npc.name" class="self-start">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <UAvatar :icon="avatarIconForNpc(npc.name)" :alt="npc.name" size="md" />
                <div class="space-y-1">
                  <h3 class="font-display text-base text-highlighted">{{ npc.name }}</h3>
                  <p class="text-[11px] uppercase tracking-[0.18em] text-dimmed">{{ npc.faction }}</p>
                </div>
              </div>
              <UBadge color="info" variant="outline" :label="npc.status" />
            </div>
            <div class="mt-3 space-y-1 text-sm leading-6 text-muted">
              <p>Location: {{ npc.location }}</p>
              <p>Relationship: {{ npc.relationship }}</p>
            </div>
            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="outline">Open profile</UButton>
                <UButton size="xs" variant="ghost">Link quest</UButton>
              </div>
            </template>
          </UCard>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="space-y-1">
            <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UAvatar and UAvatarGroup</h2>
            <p class="text-sm text-muted">
              Use Twemoji icon avatars for fast-recognition placeholders in party strips, ownership rows, and NPC cluster views.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base text-highlighted">UAvatar variants</h3>
            </template>

            <div class="space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <UAvatar icon="i-twemoji-crossed-swords" alt="Captain Mirel" size="lg" chip />
                <UAvatar icon="i-twemoji-crystal-ball" alt="Seraphine Vale" size="lg" chip />
                <UAvatar icon="i-twemoji-compass" alt="Tallow Venn" size="lg" />
                <UAvatar alt="Rowan Ashwalker" size="lg" />
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UAvatar alt="Iri Dawnsworn" size="md" />
                <UAvatar icon="i-twemoji-sparkles" size="md" />
                <UAvatar text="+3" size="md" />
                <UAvatar icon="i-twemoji-scroll" alt="Session Scribe" size="md" chip />
              </div>
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base text-highlighted">UAvatarGroup party strip</h3>
            </template>

            <div class="space-y-4">
              <UAvatarGroup size="lg">
                <UAvatar icon="i-twemoji-crossed-swords" alt="Captain Mirel" />
                <UAvatar icon="i-twemoji-crystal-ball" alt="Seraphine Vale" />
                <UAvatar icon="i-twemoji-compass" alt="Tallow Venn" />
                <UAvatar icon="i-twemoji-dragon-face" alt="Ashen Drake" />
              </UAvatarGroup>
              <p class="text-sm leading-6 text-muted">
                Use a grouped strip in session headers to show who is currently involved without expanding a full NPC panel.
              </p>
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base text-highlighted">UAvatarGroup overflow</h3>
            </template>

            <div class="space-y-4">
              <UAvatarGroup size="md" :max="3">
                <UAvatar icon="i-twemoji-crossed-swords" alt="Captain Mirel" />
                <UAvatar icon="i-twemoji-crystal-ball" alt="Seraphine Vale" />
                <UAvatar icon="i-twemoji-compass" alt="Tallow Venn" />
                <UAvatar icon="i-twemoji-scroll" alt="Archivist Nera" />
                <UAvatar icon="i-twemoji-castle" alt="Lantern Court Envoy" />
              </UAvatarGroup>
              <div class="space-y-2 rounded-lg border border-default bg-accented p-3">
                <div class="flex items-center gap-2">
                  <UAvatar icon="i-twemoji-scroll" alt="Rowan Ashwalker" size="xs" />
                  <p class="text-sm text-default">Owned by Rowan Ashwalker</p>
                </div>
                <div class="flex items-center gap-2">
                  <UAvatar icon="i-twemoji-crossed-swords" alt="Captain Mirel" size="xs" />
                  <p class="text-sm text-default">Primary NPC contact: Captain Mirel</p>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UModal: short focused workflows</h2>
        </template>

        <div class="space-y-4">
          <UButton icon="i-lucide-scroll" variant="solid" @click="isQuestModalOpen = true">Open create quest example</UButton>

          <UModal
            v-model:open="isQuestModalOpen"
            title="Create quest"
            description="A short, contextual workflow that keeps the campaign route in view."
          >
            <template #body>
              <div class="space-y-4">
                <UInput placeholder="Investigate the bells beneath the archive" />
                <UTextarea :rows="4" placeholder="Why this matters next session" />
              </div>
            </template>
            <template #footer>
              <UButton variant="ghost" @click="isQuestModalOpen = false">Cancel</UButton>
              <UButton variant="solid" @click="isQuestModalOpen = false">Create quest</UButton>
            </template>
          </UModal>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UTabs and UTable</h2>
        </template>

        <div class="space-y-4">
          <UTabs v-model="activeSessionTab" :items="sessionTabs" :content="false" class="w-full" />

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base text-highlighted">{{ activeSessionPanel.title }}</h3>
            </template>

            <p class="text-sm leading-6 text-muted">{{ activeSessionPanel.description }}</p>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li v-for="bullet in activeSessionPanel.bullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </UCard>

          <UTable :data="questRows" :columns="questColumns" caption="Quest list preview" sticky="header" class="max-h-72" />
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UButton options for campaign flows</h2>
        </template>

        <div class="space-y-5">
          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Variants</p>
            <div class="flex flex-wrap gap-2">
              <UButton v-for="variant in buttonVariants" :key="`button-variant-${variant}`" :variant="variant" color="primary">
                {{ labelize(variant) }}
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Semantic colors</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="color in semanticColors"
                :key="`button-color-${color}`"
                :color="color"
                variant="outline"
              >
                {{ labelize(color) }}
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Sizes</p>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-for="size in controlSizes"
                :key="`button-size-${size}`"
                :size="size"
                icon="i-lucide-plus"
              >
                Add quest
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">States and compositions</p>
            <div class="flex flex-wrap items-center gap-2">
              <UButton loading loading-auto>Saving note</UButton>
              <UButton disabled variant="outline">Disabled action</UButton>
              <UButton square icon="i-lucide-search" aria-label="Search campaign data" />
              <UButton :avatar="{ icon: 'i-twemoji-mage', alt: 'Dungeon Master' }" color="neutral" variant="soft">Assign DM</UButton>
              <UButton to="/docs/ux-style-guide/interaction" variant="link" trailing-icon="i-lucide-arrow-right">Interaction guide</UButton>
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="self-start">
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Fast note capture</h2>
        </template>
        <div class="space-y-3">
          <UInput placeholder="Suspicion about the harbor ledger" />
          <UTextarea :rows="4" placeholder="Write the note while the session context is still fresh." />
          <div class="flex flex-wrap gap-2">
            <UButton size="sm">Save note</UButton>
            <UButton size="sm" variant="ghost">Save draft</UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UBadge options for status signaling</h2>
        </template>

        <div class="space-y-5">
          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Variants</p>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="variant in badgeVariants"
                :key="`badge-variant-${variant}`"
                :variant="variant"
                color="info"
                label="Session 13"
              />
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Semantic colors</p>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="color in semanticColors"
                :key="`badge-color-${color}`"
                :color="color"
                variant="soft"
                :label="labelize(color)"
              />
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.16em] text-dimmed">Sizes and icon/avatar options</p>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge v-for="size in controlSizes" :key="`badge-size-${size}`" :size="size" color="warning" label="Urgent" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge icon="i-lucide-flame" color="error" label="Boss fight" />
              <UBadge trailing-icon="i-lucide-arrow-right" color="info" label="Next scene" />
              <UBadge :avatar="{ icon: 'i-twemoji-scroll', alt: 'Quest owner' }" color="neutral" variant="outline" label="Owned by Rowan" />
              <UBadge square color="primary" variant="solid" label="3" />
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">UAlert options for campaign feedback</h2>
        </template>

        <div class="space-y-4">
          <UAlert
            title="Ritual clock advanced"
            description="The drowned bell rang once. Next trigger is the flooded chapel reveal."
            color="warning"
            variant="soft"
            icon="i-lucide-hourglass"
          />

          <UAlert
            title="Session notes synced"
            description="All player notes from Session 12 are saved and linked to their owning characters."
            color="success"
            variant="outline"
            icon="i-lucide-check-circle-2"
            :actions="[
              { label: 'Open notes', icon: 'i-lucide-notebook-pen', variant: 'soft', color: 'success' },
              { label: 'Share recap', icon: 'i-lucide-send', variant: 'ghost', color: 'neutral' },
            ]"
            orientation="horizontal"
          />

          <UAlert
            v-model:open="isRitualAlertOpen"
            title="High threat encounter near Emberfall Docks"
            description="This warning is dismissible and includes contextual actions."
            :avatar="{ icon: 'i-twemoji-dragon-face', alt: 'Threat marker' }"
            color="error"
            variant="subtle"
            :actions="alertActions"
            :close="{ color: 'neutral', variant: 'link' }"
            close-icon="i-lucide-shield-x"
          />
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Character quick-reference and notes</h2>
        </template>

        <div class="grid gap-4 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-highlighted">Character quick-reference</h3>
            </template>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div v-for="stat in characterStats" :key="stat.label" class="rounded-lg border border-default bg-accented p-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-dimmed">{{ stat.label }}</p>
                <p class="mt-1 font-display text-lg text-highlighted">{{ stat.value }}</p>
              </div>
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-highlighted">Recent player notes</h3>
            </template>

            <div class="space-y-2">
              <UCard v-for="note in playerNotes" :key="note.title" class="self-start">
                <p class="text-sm font-medium text-default">{{ note.title }}</p>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-dimmed">{{ note.meta }}</p>
              </UCard>
            </div>
          </UCard>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>
