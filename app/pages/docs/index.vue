<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const { docsEntries } = useUiRefreshDocs()
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="UI Refresh Documentation"
      headline="Docs"
      description="Example docs routes used to validate UIR-2 docs layout composition."
    />

    <UPageBody>
      <div class="grid gap-4 md:grid-cols-2">
        <UCard v-for="entry in docsEntries" :key="entry.slug">
          <template #header>
            <div class="space-y-1">
              <p class="text-xs uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">Guide</p>
              <h2 class="text-base font-semibold text-[var(--ui-text-highlighted)]">{{ entry.title }}</h2>
            </div>
          </template>

          <p class="text-sm text-[var(--ui-text-muted)]">{{ entry.description }}</p>

          <template #footer>
            <UButton :to="`/docs/${entry.slug}`" variant="outline" size="sm">Open</UButton>
          </template>
        </UCard>
      </div>
    </UPageBody>
  </div>
</template>
