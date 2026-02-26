<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const searchInput = ref('')
const search = ref<string | undefined>(undefined)
const page = ref(1)
const pageSize = 20

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-journal-${publicSlug.value}-${search.value || ''}-${page.value}`,
  () =>
    publicCampaign.getJournalEntries(publicSlug.value, {
      search: search.value,
      page: page.value,
      pageSize,
    })
)

const applySearch = async () => {
  page.value = 1
  search.value = searchInput.value.trim() || undefined
  await refresh()
}

const clearSearch = async () => {
  searchInput.value = ''
  page.value = 1
  search.value = undefined
  await refresh()
}

const previousPage = async () => {
  if ((response.value?.pagination.page || 1) <= 1) return
  page.value -= 1
  await refresh()
}

const nextPage = async () => {
  const current = response.value?.pagination.page || 1
  const totalPages = response.value?.pagination.totalPages || 1
  if (current >= totalPages) return
  page.value += 1
  await refresh()
}
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Journal</h2>
                <p class="text-sm text-muted">
                  Public journal only includes entries shared with campaign visibility.
                </p>
              </div>
              <form class="flex w-full max-w-xl gap-2" @submit.prevent="applySearch">
                <UInput
                  v-model="searchInput"
                  class="flex-1"
                  placeholder="Search title, body, or tag"
                />
                <UButton type="submit" variant="outline">Search</UButton>
                <UButton
                  v-if="search"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  @click="clearSearch"
                >
                  Clear
                </UButton>
              </form>
            </div>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-16 w-full animate-pulse rounded bg-muted" />
            <div class="h-16 w-full animate-pulse rounded bg-muted" />
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Journal entries are not available for this campaign.</p>
            <UButton variant="outline" @click="() => refresh()">Try again</UButton>
          </div>

          <div v-else-if="!response?.items.length" class="text-sm text-muted">
            No public journal entries available.
          </div>

          <div v-else class="space-y-3">
            <article
              v-for="entry in response.items"
              :key="entry.id"
              class="rounded-lg border border-default bg-elevated/20 p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ entry.title }}</h3>
                <p class="text-xs text-muted">
                  {{ new Date(entry.updatedAt).toLocaleString() }}
                </p>
              </div>
              <p class="mt-1 text-xs text-muted">By {{ entry.authorName }}</p>

              <div v-if="entry.tags.length" class="mt-2 flex flex-wrap gap-1">
                <UBadge
                  v-for="tag in entry.tags"
                  :key="`${entry.id}-${tag.id}`"
                  color="neutral"
                  variant="soft"
                >
                  {{ tag.displayLabel }}
                </UBadge>
              </div>

              <div v-if="entry.sessions.length" class="mt-2 flex flex-wrap gap-1">
                <UBadge
                  v-for="session in entry.sessions"
                  :key="`${entry.id}-${session.sessionId}`"
                  color="primary"
                  variant="outline"
                >
                  {{ session.sessionNumber ? `Session ${session.sessionNumber}` : session.title }}
                </UBadge>
              </div>

              <MDC :value="entry.contentMarkdown" tag="article" class="prose prose-sm mt-3 max-w-none" />
            </article>
          </div>

          <div
            v-if="response && response.pagination.totalPages > 1"
            class="mt-4 flex items-center justify-between gap-2"
          >
            <p class="text-xs text-muted">
              Page {{ response.pagination.page }} of {{ response.pagination.totalPages }}
            </p>
            <div class="flex gap-2">
              <UButton
                variant="outline"
                size="sm"
                :disabled="response.pagination.page <= 1"
                @click="previousPage"
              >
                Previous
              </UButton>
              <UButton
                variant="outline"
                size="sm"
                :disabled="response.pagination.page >= response.pagination.totalPages"
                @click="nextPage"
              >
                Next
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>
