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
            <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,rgba(87,196,255,0.14),transparent_34%),linear-gradient(135deg,rgba(15,27,38,0.96),rgba(32,47,66,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-cyan-100/60">Header region</p>
                <p class="font-display mt-1 text-lg tracking-[0.03em] text-cyan-50">Dungeon master dashboard</p>
                <p class="mt-1 text-sm text-cyan-50/70">What needs attention now, what session is next, and which threads are unresolved.</p>
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
                class="self-start border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))]"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">{{ card.eyebrow }}</p>
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
            <div class="rounded-xl border border-amber-200/15 bg-[radial-gradient(circle_at_top_left,rgba(241,189,94,0.14),transparent_32%),linear-gradient(135deg,rgba(37,27,20,0.96),rgba(63,45,30,0.94))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.18em] text-amber-100/60">Campaign header</p>
                  <p class="font-display mt-1 text-lg tracking-[0.03em] text-amber-50">Emberfall Campaign</p>
                  <p class="mt-1 text-sm text-amber-50/72">Dark mystery • Current arc: drowned bells • Next session: March 8</p>
                </div>
                <UBadge color="warning" variant="outline" label="Arc at risk" />
              </div>
            </div>

            <UTabs :items="sessionTabs" :content="false" class="w-full" />

            <div class="grid gap-3 lg:grid-cols-2">
              <UCard
                v-for="zone in campaignViewZones"
                :key="zone.title"
                class="self-start border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))]"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-amber-300/75">{{ zone.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ zone.title }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ zone.detail }}</p>
              </UCard>
            </div>

            <div class="grid gap-3 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div class="space-y-3 rounded-[1.25rem] border border-violet-200/10 bg-[radial-gradient(circle_at_top_left,rgba(179,132,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,160,98,0.14),transparent_32%),linear-gradient(135deg,rgba(20,23,39,0.98),rgba(65,36,33,0.94))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-violet-100/60">Session scene board</p>
                    <p class="font-display mt-1 text-xl tracking-[0.04em] text-white">Bells Under Emberfall: Act One</p>
                  </div>
                  <UBadge color="warning" variant="outline" label="Ritual in progress" />
                </div>

                <div class="grid gap-3 md:grid-cols-3">
                  <UCard
                    v-for="scene in scenePrepCards"
                    :key="scene.title"
                    class="self-start border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]"
                  >
                    <p class="text-[11px] uppercase tracking-[0.18em] text-violet-100/60">{{ scene.eyebrow }}</p>
                    <p class="mt-2 font-display text-base text-white">{{ scene.title }}</p>
                    <p class="mt-2 text-sm leading-6 text-white/72">{{ scene.detail }}</p>
                  </UCard>
                </div>
              </div>

              <UCard class="self-start border-violet-200/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]">
                <template #header>
                  <h3 class="font-display text-base tracking-[0.03em] text-[var(--ui-text-highlighted)]">Ritual clock</h3>
                </template>

                <div class="space-y-3">
                  <div
                    v-for="step in ritualTrack"
                    :key="step"
                    class="rounded-lg border border-violet-200/10 bg-[radial-gradient(circle_at_left,rgba(162,121,255,0.12),transparent_30%),var(--ui-bg-accented)] p-3"
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
