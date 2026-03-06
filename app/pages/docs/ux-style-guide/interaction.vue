<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const { interactionGuidelines, questActionItems, shortcutExamples, feedbackStates } = useUxStyleGuideContent()
</script>

<template>
  <UPage>
    <UPageHeader
      title="Interaction"
      headline="UX Style Guide"
      description="How hover, click, focus, keyboard shortcuts, and inline feedback should behave during live play and prep."
    />

    <UPageBody class="space-y-8">
      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Hover, click, and focus behavior</h2>
        </template>

        <ul class="space-y-3 text-sm leading-6 text-[var(--ui-text-muted)]">
          <li v-for="guideline in interactionGuidelines" :key="guideline" class="flex gap-2">
            <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-info-400" />
            <span>{{ guideline }}</span>
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Demonstration: scoped row actions and inline feedback</h2>
        </template>

        <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div class="space-y-3 rounded-xl border border-rose-200/10 bg-[radial-gradient(circle_at_top_left,rgba(255,129,146,0.14),transparent_30%),linear-gradient(135deg,rgba(45,22,28,0.98),rgba(35,33,48,0.94))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div class="flex items-start justify-between gap-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3">
              <div class="space-y-1">
                <p class="font-display text-base text-[var(--ui-text-highlighted)]">Question the Harbor Smuggler</p>
                <p class="text-sm leading-6 text-[var(--ui-text-muted)]">The row is clearly actionable, but secondary controls do not hijack the primary target.</p>
              </div>

              <div class="flex flex-wrap gap-2">
                <UTooltip text="Pin to session prep">
                  <UButton size="xs" variant="ghost" icon="i-lucide-pin" aria-label="Pin to session prep" />
                </UTooltip>
                <UDropdownMenu :items="questActionItems" :content="{ align: 'end' }">
                  <UButton size="xs" variant="ghost" icon="i-lucide-ellipsis-vertical" aria-label="More actions" />
                </UDropdownMenu>
              </div>
            </div>

            <div class="flex flex-wrap items-start gap-2">
              <UBadge v-for="state in feedbackStates" :key="state.label" :label="state.label" :color="state.color" variant="outline" />
            </div>
          </div>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-lg text-[var(--ui-text-highlighted)]">Why it works</h3>
            </template>
            <p class="text-sm leading-6 text-[var(--ui-text-muted)]">
              The action model stays clear under pressure: the main row still means “open this thread,” icon-only controls get tooltips, and save state appears next to the thing that changed.
            </p>
          </UCard>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-display text-xl tracking-[0.03em] text-[var(--ui-text-highlighted)]">Suggested shortcuts</h2>
        </template>

        <div class="grid gap-3 md:grid-cols-2">
          <div
            v-for="shortcut in shortcutExamples"
            :key="shortcut.description"
            class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-accented)] p-3"
          >
            <div class="flex items-center gap-2">
              <UKbd v-for="key in shortcut.keys" :key="key">{{ key }}</UKbd>
            </div>
            <p class="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">{{ shortcut.description }}</p>
          </div>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>
