<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { loggedIn, ready } = useUserSession()
const publicCampaign = usePublicCampaign()

const {
  data: randomPublicCampaigns,
  pending: randomCampaignsPending,
} = await useAsyncData('public-campaigns-random-sample', () =>
  publicCampaign.listCampaigns({ random: true, limit: 6 })
)

const features = [
  {
    icon: 'i-lucide-scroll-text',
    title: 'Session Logs',
    description: 'Upload recordings, auto-generate transcripts, and produce summaries for every session.',
  },
  {
    icon: 'i-lucide-map',
    title: 'World Building',
    description: 'Manage quests, milestones, interactive maps, and a living glossary for your campaign.',
  },
  {
    icon: 'i-lucide-sword',
    title: 'Combat Tracker',
    description: 'Run encounters with full initiative tracking, combatant conditions, and event logs.',
  },
]
</script>

<template>
  <div class="space-y-16">
    <!-- Hero -->
    <div class="theme-reveal max-w-3xl space-y-6">
      <p class="font-display text-xs tracking-[0.35em] uppercase text-primary-500">Dungeon Master Vault</p>
      <h1 class="font-display text-4xl font-semibold leading-tight text-highlighted sm:text-5xl">
        Run smarter campaigns<br class="hidden sm:block"> with one home base
      </h1>
      <p class="max-w-2xl text-base leading-relaxed text-muted">
        Track sessions, manage your world, and keep transcripts and summaries tidy.
        Built to keep your D&amp;D campaign organized and searchable.
      </p>
      <div class="flex flex-wrap gap-3 pt-1">
        <UButton v-if="ready && !loggedIn" size="lg" to="/login">Go to login</UButton>
        <UButton v-else-if="ready && loggedIn" size="lg" to="/campaigns">Open campaigns</UButton>
        <UButton v-else size="lg" loading>Loading session</UButton>
        <UButton size="lg" variant="outline" to="/public">Browse public campaigns</UButton>
      </div>
    </div>

    <!-- Feature highlights -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="feature in features"
        :key="feature.title"
        class="theme-panel rounded-md p-5 space-y-3"
      >
        <UIcon :name="feature.icon" class="size-5 text-primary-500" />
        <div class="space-y-1">
          <p class="font-display text-sm font-semibold tracking-[0.08em] uppercase text-highlighted">
            {{ feature.title }}
          </p>
          <p class="text-sm leading-relaxed text-muted">{{ feature.description }}</p>
        </div>
      </div>
    </div>

    <!-- Public campaign directory -->
    <PublicCampaignDirectoryList
      title="Featured public campaigns"
      description="A random sample from campaigns published to the directory."
      :campaigns="randomPublicCampaigns"
      :loading="randomCampaignsPending"
      empty-message="No campaigns are currently listed in the public directory."
    />
  </div>
</template>
