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
        <UCard class="self-start">
          <template #header>
            <div class="space-y-1">
              <h2 class="font-display text-xl tracking-[0.04em] text-[var(--ui-text-highlighted)]">Demonstration: philosophy in one screen</h2>
              <p class="text-sm text-[var(--ui-text-muted)]">A campaign summary that makes urgency, tone, and the next move obvious immediately.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-5">
              <div class="space-y-2">
                <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">Campaign overview preview</p>
                <h3 class="font-display text-xl tracking-[0.04em] text-[var(--ui-text-highlighted)]">Emberfall: Bells Beneath the Archive</h3>
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
                class="self-start"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/75">{{ card.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ card.title }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ card.detail }}</p>
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
