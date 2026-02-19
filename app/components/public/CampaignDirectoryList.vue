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
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <p v-if="description" class="text-sm text-muted">{{ description }}</p>
      </div>
    </template>

    <div v-if="loading" class="space-y-2">
      <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
      <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
    </div>

    <div v-else-if="!campaigns?.length" class="text-sm text-muted">
      {{ emptyMessage || 'No public campaigns found.' }}
    </div>

    <div v-else class="grid gap-3 md:grid-cols-2">
      <NuxtLink
        v-for="campaign in campaigns"
        :key="campaign.publicSlug"
        :to="`/public/${campaign.publicSlug}`"
        class="rounded-lg border border-default bg-elevated/20 p-3 transition hover:border-primary/40 hover:bg-primary/5"
      >
        <p class="text-sm font-semibold">{{ campaign.name }}</p>
        <p class="text-xs text-muted">{{ campaign.system }}</p>
        <p v-if="campaign.dungeonMasterName" class="text-xs text-muted">DM: {{ campaign.dungeonMasterName }}</p>
        <p v-if="campaign.description" class="mt-2 text-xs text-muted line-clamp-3">{{ campaign.description }}</p>
      </NuxtLink>
    </div>
  </UCard>
</template>
