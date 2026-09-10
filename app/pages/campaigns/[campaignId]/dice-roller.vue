<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <CampaignListTemplate
    title="Dice roller"
  >
    <CampaignToolsDiceRoller />
  </CampaignListTemplate>
</template>
