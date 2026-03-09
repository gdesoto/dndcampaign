<script setup lang="ts">
type DirectoryItem = {
  publicSlug: string
  publicUrl: string
  name: string
  system: string
  description: string | null
  dungeonMasterName: string | null
  updatedAt: string
}

defineProps<{
  title: string
  description?: string
  campaigns: DirectoryItem[] | null | undefined
  loading?: boolean
  emptyMessage?: string
}>()

function formatUpdatedAt(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="font-display text-base font-semibold tracking-[0.06em] uppercase text-highlighted">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</p>
      </div>
    </template>

    <div v-if="loading" class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="i in 6"
        :key="i"
        class="rounded-md border border-default bg-elevated/20 p-4 space-y-2"
      >
        <div class="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div class="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div class="h-3 w-full animate-pulse rounded bg-muted mt-3" />
        <div class="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
    </div>

    <p v-else-if="!campaigns?.length" class="text-sm text-muted">
      {{ emptyMessage || 'No public campaigns found.' }}
    </p>

    <div v-else class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="campaign in campaigns"
        :key="campaign.publicSlug"
        :to="`/public/${campaign.publicSlug}`"
        class="group flex flex-col rounded-md border border-default bg-elevated/20 p-4 transition hover:border-accented hover:bg-primary/5"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="font-display text-sm font-semibold tracking-[0.05em] text-highlighted transition-colors group-hover:text-primary-400">
            {{ campaign.name }}
          </p>
          <UIcon
            name="i-lucide-chevron-right"
            class="mt-0.5 size-4 shrink-0 text-dimmed opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <UBadge variant="outline" size="sm">{{ campaign.system }}</UBadge>
          <span v-if="campaign.dungeonMasterName" class="text-xs text-dimmed">
            DM: {{ campaign.dungeonMasterName }}
          </span>
        </div>

        <p v-if="campaign.description" class="mt-3 flex-1 text-xs leading-relaxed text-muted line-clamp-3">
          {{ campaign.description }}
        </p>

        <p class="mt-3 text-xs text-dimmed">
          Updated {{ formatUpdatedAt(campaign.updatedAt) }}
        </p>
      </NuxtLink>
    </div>
  </UCard>
</template>
