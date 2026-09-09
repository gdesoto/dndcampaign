<script setup lang="ts">
const { publicSlug, overview, overviewPending, overviewError, refreshOverview } = await usePublicCampaignPageContext()
</script>

<template>
  <div class="space-y-4">
    <SharedResourceState :pending="overviewPending" :has-data="Boolean(overview)" :error="overviewError" :empty="!overview" empty-message="This public campaign is unavailable." @retry="refreshOverview">
      <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />
      <NuxtPage />
    </SharedResourceState>
  </div>
</template>
