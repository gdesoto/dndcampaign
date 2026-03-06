<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const { realEstateTips, densityGuidelines, dashboardPreviewCards, rightRailItems, trackerExamples, mapLocations, playerNotes } = useUxStyleGuideContent()
</script>

<template>
  <UPage>
    <UPageHeader
      title="Readability"
      headline="UX Style Guide"
      description="How to use screen space well, keep dense information readable, and present quests, maps, and notes without overwhelming the DM."
    />

    <UPageBody class="space-y-8">
      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Screen real estate</h2>
        </template>

        <div class="space-y-4">
          <UCard v-for="tip in realEstateTips" :key="tip.title" class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">{{ tip.title }}</h3>
            </template>
            <p class="text-sm leading-6 text-[var(--ui-text-muted)]">{{ tip.guidance }}</p>
          </UCard>

          <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div class="space-y-3 rounded-xl border border-emerald-200/10 bg-[radial-gradient(circle_at_top_left,rgba(112,214,177,0.13),transparent_32%),linear-gradient(135deg,rgba(18,31,31,0.96),rgba(27,48,43,0.94))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.2)]">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.18em] text-emerald-100/60">Visible without scrolling</p>
                  <p class="font-display mt-1 text-lg tracking-[0.03em] text-emerald-50">Tonight’s briefing</p>
                </div>
                <UButton size="sm">Resume prep</UButton>
              </div>

              <div class="grid gap-3 sm:grid-cols-3">
                <UCard v-for="card in dashboardPreviewCards" :key="card.title" class="self-start">
                  <p class="text-[11px] uppercase tracking-[0.18em] text-emerald-300/75">{{ card.eyebrow }}</p>
                  <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ card.title }}</p>
                </UCard>
              </div>
            </div>

            <UCard class="self-start">
              <template #header>
                <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Right rail support</h3>
              </template>
              <ul class="space-y-2 text-sm leading-6 text-[var(--ui-text-muted)]">
                <li v-for="item in rightRailItems" :key="item" class="flex gap-2">
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </UCard>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Data-dense interfaces</h2>
        </template>

        <div class="space-y-4">
          <UCard v-for="tip in densityGuidelines" :key="tip.title" class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">{{ tip.title }}</h3>
            </template>
            <p class="text-sm leading-6 text-[var(--ui-text-muted)]">{{ tip.guidance }}</p>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <div class="space-y-1">
                <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">{{ trackerExamples[4]?.title }}</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">{{ trackerExamples[4]?.summary }}</p>
              </div>
            </template>

            <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div class="rounded-lg border border-dashed border-[var(--ui-border)] bg-[radial-gradient(circle_at_top_left,rgba(193,154,107,0.18),transparent_40%),linear-gradient(135deg,rgba(26,36,44,0.78),rgba(52,40,28,0.88))] p-4">
                <div class="grid min-h-48 place-items-center rounded-md border border-white/10 bg-black/10">
                  <div class="space-y-2 text-center">
                    <p class="text-xs uppercase tracking-[0.18em] text-white/60">Catacombs of Emberfall</p>
                    <p class="text-sm text-white/80">Pins, labels, and route context remain readable without hover.</p>
                  </div>
                </div>
              </div>

              <UCard class="self-start">
                <template #header>
                  <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">Pinned locations</h4>
                </template>
                <ul class="space-y-3 text-sm leading-6 text-[var(--ui-text-muted)]">
                  <li v-for="location in mapLocations" :key="location.name">
                    <p class="font-medium text-[var(--ui-text)]">{{ location.name }}</p>
                    <p>{{ location.detail }}</p>
                  </li>
                </ul>
              </UCard>
            </div>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <div class="space-y-1">
                <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">{{ trackerExamples[5]?.title }}</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">{{ trackerExamples[5]?.summary }}</p>
              </div>
            </template>

            <div class="grid gap-4 lg:grid-cols-[1fr_0.95fr] lg:items-start">
              <div class="space-y-3">
                <UCard v-for="note in playerNotes" :key="note.title" class="self-start">
                  <p class="font-medium text-[var(--ui-text)]">{{ note.title }}</p>
                  <p class="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--ui-text-dimmed)]">{{ note.meta }}</p>
                  <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ note.excerpt }}</p>
                </UCard>
              </div>

              <UCard class="self-start">
                <template #header>
                  <h4 class="font-display text-base text-[var(--ui-text-highlighted)]">Quick capture</h4>
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
          </UCard>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>
