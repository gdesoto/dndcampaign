<script setup lang="ts">
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
</script>

<template>
  <UPage>
    <UPageHeader
      title="Components"
      headline="UX Style Guide"
      description="Nuxt UI patterns for campaign objects, page regions, workflows, tabs, data tables, and fast-capture controls."
    />

    <UPageBody class="space-y-8">
      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Cards, panels, and directory patterns</h2>
        </template>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <div class="space-y-1">
                <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Quest tracker cards</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">{{ trackerExamples[0]?.summary }}</p>
              </div>
            </template>

            <div class="grid gap-3 lg:grid-cols-2">
              <UCard class="self-start">
                <template #header>
                  <div class="flex items-center justify-between gap-3">
                    <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">Recover the Moonstone Lens</h4>
                    <UBadge color="success" variant="outline" label="Active" />
                  </div>
                </template>
                <p class="text-sm leading-6 text-[var(--ui-text-muted)]">Patron: Seraphine • Next hook: open the sealed observatory.</p>
                <template #footer>
                  <UButton size="sm" variant="solid">Open quest</UButton>
                </template>
              </UCard>

              <div class="grid gap-3">
                <UCard class="self-start">
                  <template #header>
                    <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">Current Arc</h4>
                  </template>
                  <p class="text-sm leading-6 text-[var(--ui-text-muted)]">The bells wake what the city buried.</p>
                </UCard>
                <UCard class="self-start">
                  <template #header>
                    <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">Session Prep</h4>
                  </template>
                  <ul class="space-y-2 text-sm leading-6 text-[var(--ui-text-muted)]">
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
                <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">NPC directory cards</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">{{ trackerExamples[1]?.summary }}</p>
              </div>
            </template>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <UCard v-for="npc in npcExamples" :key="npc.name" class="self-start">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">{{ npc.name }}</h4>
                    <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">{{ npc.faction }}</p>
                  </div>
                  <UBadge color="info" variant="outline" :label="npc.status" />
                </div>
                <div class="mt-3 space-y-1 text-sm leading-6 text-[var(--ui-text-muted)]">
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
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Modal, tabs, and tables</h2>
        </template>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">UModal: short focused workflows</h3>
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
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">UTabs and UTable</h3>
            </template>

            <div class="space-y-4">
              <UTabs v-model="activeSessionTab" :items="sessionTabs" :content="false" class="w-full" />

              <UCard class="self-start">
                <template #header>
                  <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">{{ activeSessionPanel.title }}</h4>
                </template>

                <p class="text-sm leading-6 text-[var(--ui-text-muted)]">{{ activeSessionPanel.description }}</p>
                <ul class="mt-3 space-y-2 text-sm leading-6 text-[var(--ui-text-muted)]">
                  <li v-for="bullet in activeSessionPanel.bullets" :key="bullet">{{ bullet }}</li>
                </ul>
              </UCard>

              <UTable :data="questRows" :columns="questColumns" caption="Quest list preview" sticky="header" class="max-h-72" />
            </div>
          </UCard>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Buttons, badges, and capture controls</h2>
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Action hierarchy</h3>
            </template>
            <div class="flex flex-wrap items-start gap-3">
              <UButton icon="i-lucide-plus">Add NPC</UButton>
              <UButton variant="outline">Open session prep</UButton>
              <UButton variant="ghost">Pin to dashboard</UButton>
              <UButton color="error" variant="soft">Archive quest</UButton>
            </div>
            <div class="mt-4 flex flex-wrap items-start gap-2">
              <UBadge color="success" variant="outline" label="Ready" />
              <UBadge color="info" variant="outline" label="Active" />
              <UBadge color="warning" variant="outline" label="Needs Prep" />
              <UBadge color="error" variant="outline" label="Blocked" />
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Fast note capture</h3>
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
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Character quick-reference</h3>
            </template>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div v-for="stat in characterStats" :key="stat.label" class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">{{ stat.label }}</p>
                <p class="mt-1 font-display text-lg text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
              </div>
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Recent player notes</h3>
            </template>

            <div class="space-y-2">
              <UCard v-for="note in playerNotes" :key="note.title" class="self-start">
                <p class="text-sm font-medium text-[var(--ui-text)]">{{ note.title }}</p>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--ui-text-dimmed)]">{{ note.meta }}</p>
              </UCard>
            </div>
          </UCard>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>
