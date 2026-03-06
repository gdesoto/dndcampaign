<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ layout: 'docs' })

const { uxGuidePages, principles, dashboardPreviewCards } = useUxStyleGuideContent()

const tocLinks: NavigationMenuItem[] = [
  { label: 'Use This Guide', to: '#use-this-guide', icon: 'i-lucide-book-open' },
  { label: 'Core Pillars', to: '#pillars', icon: 'i-lucide-compass' },
  { label: 'Explore Pages', to: '#pages', icon: 'i-lucide-map' },
]
</script>

<template>
  <UPage>
    <UPageHeader
      title="UX Style Guide"
      headline="Docs"
      description="A multi-page guide for designing campaign dashboards, character tools, notes, maps, and session workspaces with strong game-facing UX."
    >
      <template #links>
        <UBadge color="warning" variant="outline" label="Campaign-first" />
        <UBadge color="info" variant="outline" label="Nuxt UI patterns" />
        <UBadge color="success" variant="outline" label="Live demonstrations" />
      </template>
    </UPageHeader>

    <UPageBody class="space-y-8">
      <section id="use-this-guide" class="space-y-4 scroll-mt-28">
        <UCard class="self-start">
          <div class="space-y-4">
            <p class="text-xs uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">How to use this guide</p>
            <h2 class="font-display text-2xl tracking-[0.04em] text-[var(--ui-text-highlighted)]">Build interfaces that feel like a campaign desk, not a generic admin tool.</h2>
            <p class="max-w-3xl text-sm leading-7 text-[var(--ui-text-muted)]">
              This guide is split into focused pages so developers can move from philosophy to layouts to component patterns without scanning one giant document.
              Each section pairs principles with concrete in-app demonstrations grounded in quests, factions, omens, maps, and player choices.
            </p>
          </div>
        </UCard>
      </section>

      <section id="pillars" class="space-y-4 scroll-mt-28">
        <div class="space-y-2">
          <h2 class="font-display text-sm uppercase tracking-[0.12em] text-[var(--ui-text-dimmed)]">Core pillars</h2>
          <p class="max-w-3xl text-sm leading-7 text-[var(--ui-text-muted)]">
            The guide is built around legibility, world-language, clear action mapping, progressive disclosure, and strong visual hierarchy.
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <UCard v-for="principle in principles" :key="principle.title" class="self-start">
              <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/80">{{ principle.source }}</p>
              <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ principle.title }}</p>
              <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ principle.guidance }}</p>
            </UCard>
          </div>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base tracking-[0.03em] text-[var(--ui-text-highlighted)]">Campaign desk snapshot</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="card in dashboardPreviewCards"
                :key="card.title"
                class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3"
              >
                <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-primary)]/75">{{ card.eyebrow }}</p>
                <p class="mt-2 font-display text-base text-[var(--ui-text-highlighted)]">{{ card.title }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ card.detail }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <section id="pages" class="space-y-4 scroll-mt-28">
        <div class="space-y-2">
          <h2 class="font-display text-sm uppercase tracking-[0.12em] text-[var(--ui-text-dimmed)]">Explore the guide</h2>
          <p class="max-w-3xl text-sm leading-7 text-[var(--ui-text-muted)]">
            Use the pages below as a practical sequence: why the interface works, how the layout should feel, which components to reach for, and how to keep dense information readable.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="page in uxGuidePages" :key="page.to" class="self-start">
            <template #header>
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">Section</p>
                  <h3 class="font-display text-lg tracking-[0.03em] text-[var(--ui-text-highlighted)]">{{ page.title }}</h3>
                </div>
                <UIcon :name="page.icon" class="size-5 text-[var(--ui-primary)]" />
              </div>
            </template>

            <p class="text-sm leading-6 text-[var(--ui-text-muted)]">{{ page.description }}</p>

            <template #footer>
              <UButton :to="page.to" variant="outline" size="sm">Open section</UButton>
            </template>
          </UCard>
        </div>
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
