<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()
const { getEntryBySlug } = useUiRefreshDocs()

const slugParam = computed(() => {
  const raw = route.params.slug
  if (Array.isArray(raw)) return raw[0]
  return typeof raw === 'string' ? raw : null
})

const entry = computed(() => getEntryBySlug(slugParam.value))

if (!entry.value) {
  throw createError({ statusCode: 404, statusMessage: 'Documentation page not found.' })
}

const tocLinks = computed(() =>
  (entry.value?.body || []).map((_, index) => ({
    label: `Section ${index + 1}`,
    to: `#section-${index + 1}`,
  })),
)
</script>

<template>
  <UPage>
    <UPageHeader
      :title="entry?.title"
      headline="Docs"
      :description="entry?.description"
    />

    <UPageBody>
      <article class="space-y-4">
        <section
          v-for="(paragraph, index) in entry?.body"
          :id="`section-${index + 1}`"
          :key="`${entry?.slug}-${index}`"
          class="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-4"
        >
          <h2 class="uppercase text-[var(--ui-text-muted)] type-section">
            Section {{ index + 1 }}
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-[var(--ui-text)]">{{ paragraph }}</p>
        </section>
      </article>
    </UPageBody>

    <template #right>
      <UPageAside>
        <UCard>
          <template #header>
            <h3 class="uppercase text-[var(--ui-text-dimmed)] type-record">On This Page</h3>
          </template>

          <ul class="space-y-2 text-sm">
            <li v-for="link in tocLinks" :key="link.to">
              <NuxtLink :to="link.to" class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </UCard>
      </UPageAside>
    </template>
  </UPage>
</template>
