<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ layout: 'docs' })

const { principles, dashboardPreviewCards } = useUxStyleGuideContent()

const tocLinks: NavigationMenuItem[] = [
  { label: 'Principles', to: '#principles', icon: 'i-lucide-compass' },
  { label: 'Demonstration', to: '#demonstration', icon: 'i-lucide-sparkles' },
]
</script>

<template>
  <UPage>
    <UPageHeader
      title="Philosophy"
      headline="UX Style Guide"
      description="The interface principles behind the campaign desk: visibility, world-language, affordances, progressive disclosure, and hierarchy."
    />

    <UPageBody class="space-y-8">
      <section id="principles" class="space-y-4 scroll-mt-28">
        <div class="grid gap-4">
          <UCard v-for="principle in principles" :key="principle.title">
            <template #header>
              <div class="space-y-1">
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/80">{{ principle.source }}</p>
                <h2 class="font-display text-lg tracking-[0.03em] text-[var(--ui-text-highlighted)]">{{ principle.title }}</h2>
              </div>
            </template>

            <div class="space-y-3 text-sm leading-6 text-[var(--ui-text-muted)]">
              <p>{{ principle.guidance }}</p>
              <p class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] px-3 py-2 text-[var(--ui-text)]">{{ principle.example }}</p>
            </div>
          </UCard>
        </div>
      </section>

      <section id="demonstration" class="space-y-4 scroll-mt-28">
        <UCard class="overflow-hidden border-amber-200/10 bg-[radial-gradient(circle_at_top_left,rgba(245,196,118,0.15),transparent_30%),linear-gradient(135deg,rgba(21,29,39,0.98),rgba(59,35,24,0.95))] shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <template #header>
            <div class="space-y-1">
              <h2 class="font-display text-xl tracking-[0.04em] text-amber-50">Demonstration: philosophy in one screen</h2>
              <p class="text-sm text-amber-50/75">A campaign summary that makes urgency, tone, and the next move obvious immediately.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200/15 bg-black/10 p-5">
              <div class="space-y-2">
                <p class="text-xs uppercase tracking-[0.18em] text-amber-100/60">Campaign overview preview</p>
                <h3 class="font-display text-xl tracking-[0.04em] text-amber-50">Emberfall: Bells Beneath the Archive</h3>
                <div class="flex flex-wrap gap-2">
                  <UBadge color="warning" variant="outline" label="Session tonight" />
                  <UBadge color="info" variant="outline" label="1 blocked quest" />
                  <UBadge color="success" variant="outline" label="Prep mostly ready" />
                </div>
              </div>

              <div class="flex flex-wrap items-start gap-2">
                <UButton size="sm" icon="i-lucide-plus">Add quest</UButton>
                <UButton size="sm" variant="outline">Open session prep</UButton>
              </div>
            </div>

            <div class="grid gap-3 lg:grid-cols-3">
              <UCard
                v-for="card in dashboardPreviewCards"
                :key="card.title"
                class="self-start border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-amber-200/70">{{ card.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-white">{{ card.title }}</p>
                <p class="mt-2 text-sm leading-6 text-white/72">{{ card.detail }}</p>
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
