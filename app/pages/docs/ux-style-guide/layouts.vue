<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ layout: 'docs' })

const {
  layoutGuidelines,
  dashboardPreviewCards,
  campaignViewZones,
  scenePrepCards,
  ritualTrack,
  characterStats,
  characterPreviewSections,
  questColumns,
  questRows,
  sessionTabs,
} = useUxStyleGuideContent()

const tocLinks: NavigationMenuItem[] = [
  { label: 'Guidelines', to: '#guidelines', icon: 'i-lucide-ruler' },
  { label: 'Dashboard', to: '#dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: 'Campaign', to: '#campaign', icon: 'i-lucide-castle' },
  { label: 'Characters', to: '#characters', icon: 'i-lucide-shield' },
]
</script>

<template>
  <UPage>
    <UPageHeader
      title="Layouts"
      headline="UX Style Guide"
      description="How dashboards, campaign routes, scene boards, and character pages should be composed in the D&D app."
    />

    <UPageBody class="space-y-8">
      <section id="guidelines" class="space-y-4 scroll-mt-28">
        <UCard v-for="guideline in layoutGuidelines" :key="guideline.title">
          <template #header>
            <div class="space-y-1">
              <h2 class="font-display text-lg tracking-[0.03em] text-[var(--ui-text-highlighted)]">{{ guideline.title }}</h2>
              <p class="text-sm text-[var(--ui-text-muted)]">{{ guideline.intent }}</p>
            </div>
          </template>

          <ul class="space-y-2 text-sm leading-6 text-[var(--ui-text-muted)]">
            <li v-for="practice in guideline.practices" :key="practice" class="flex gap-2">
              <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>{{ practice }}</span>
            </li>
          </ul>
        </UCard>
      </section>

      <section id="dashboard" class="space-y-4 scroll-mt-28">
        <UCard>
          <template #header>
            <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Demonstration: dashboard layout</h2>
          </template>

          <div class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-5">
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">Header region</p>
                <p class="font-display mt-1 text-lg tracking-[0.03em] text-[var(--ui-text-highlighted)]">Dungeon master dashboard</p>
                <p class="mt-1 text-sm text-[var(--ui-text-muted)]">What needs attention now, what session is next, and which threads are unresolved.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton size="sm" icon="i-lucide-plus">New session</UButton>
                <UButton size="sm" variant="outline">Campaign search</UButton>
              </div>
            </div>

            <div class="grid gap-3 lg:grid-cols-3">
              <UCard
                v-for="card in dashboardPreviewCards"
                :key="card.title"
                class="self-start"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/75">{{ card.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ card.title }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ card.detail }}</p>
              </UCard>
            </div>

            <UTable :data="questRows" :columns="questColumns" caption="Dense lists follow the summary region, not the other way around." />
          </div>
        </UCard>
      </section>

      <section id="campaign" class="space-y-4 scroll-mt-28">
        <UCard>
          <template #header>
            <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Demonstration: campaign route and scene prep</h2>
          </template>

          <div class="space-y-4">
            <div class="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">Campaign header</p>
                  <p class="font-display mt-1 text-lg tracking-[0.03em] text-[var(--ui-text-highlighted)]">Emberfall Campaign</p>
                  <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Dark mystery • Current arc: drowned bells • Next session: March 8</p>
                </div>
                <UBadge color="warning" variant="outline" label="Arc at risk" />
              </div>
            </div>

            <UTabs :items="sessionTabs" :content="false" class="w-full" />

            <div class="grid gap-3 lg:grid-cols-2">
              <UCard
                v-for="zone in campaignViewZones"
                :key="zone.title"
                class="self-start"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/75">{{ zone.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ zone.title }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ zone.detail }}</p>
              </UCard>
            </div>

            <div class="grid gap-3 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div class="space-y-3 rounded-[1.25rem] border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">Session scene board</p>
                    <p class="font-display mt-1 text-xl tracking-[0.04em] text-[var(--ui-text-highlighted)]">Bells Under Emberfall: Act One</p>
                  </div>
                  <UBadge color="warning" variant="outline" label="Ritual in progress" />
                </div>

                <div class="grid gap-3 md:grid-cols-3">
                  <UCard
                    v-for="scene in scenePrepCards"
                    :key="scene.title"
                    class="self-start"
                  >
                    <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/75">{{ scene.eyebrow }}</p>
                    <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ scene.title }}</p>
                    <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ scene.detail }}</p>
                  </UCard>
                </div>
              </div>

              <UCard class="self-start">
                <template #header>
                  <h3 class="font-display text-base tracking-[0.03em] text-[var(--ui-text-highlighted)]">Ritual clock</h3>
                </template>

                <div class="space-y-3">
                  <div
                    v-for="step in ritualTrack"
                    :key="step"
                    class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3"
                  >
                    <p class="text-sm leading-6 text-[var(--ui-text-muted)]">{{ step }}</p>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </UCard>
      </section>

      <section id="characters" class="space-y-4 scroll-mt-28">
        <UCard>
          <template #header>
            <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Demonstration: character page layout</h2>
          </template>

          <div class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="stat in characterStats"
                :key="stat.label"
                class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">{{ stat.label }}</p>
                <p class="mt-1 font-display text-lg text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
              </div>
            </div>

            <div class="grid gap-3 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <UCard class="self-start">
                <template #header>
                  <h3 class="font-display text-base tracking-[0.03em] text-[var(--ui-text-highlighted)]">High-frequency play data</h3>
                </template>

                <div class="space-y-3">
                  <div
                    v-for="section in characterPreviewSections"
                    :key="section.title"
                    class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3"
                  >
                    <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/80">{{ section.eyebrow }}</p>
                    <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ section.title }}</p>
                    <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ section.detail }}</p>
                  </div>
                </div>
              </UCard>

              <UCard class="self-start">
                <template #header>
                  <h3 class="font-display text-base tracking-[0.03em] text-[var(--ui-text-highlighted)]">Secondary information</h3>
                </template>
                <p class="text-sm leading-6 text-[var(--ui-text-muted)]">
                  Biography, downtime logs, private hooks, and archived notes still matter, but they should never push combat and exploration data out of the first reading pass.
                </p>
              </UCard>
            </div>
          </div>
        </UCard>
      </section>
    </UPageBody>

    <template #right>
      <UPageAside>
        <UCard>
          <template #header>
            <h3 class="font-display text-xs uppercase tracking-[0.1em] text-[var(--ui-text-dimmed)]">On This Page</h3>
          </template>

          <UNavigationMenu :items="tocLinks" orientation="vertical" :ui="{ linkLabel: 'font-display tracking-[0.08em] uppercase text-[11px]' }" />
        </UCard>
      </UPageAside>
    </template>
  </UPage>
</template>
