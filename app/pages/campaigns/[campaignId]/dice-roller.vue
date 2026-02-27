<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <CampaignListTemplate
    headline="Tools"
    title="Dice roller"
    description="Roll for checks, saves, attacks, and custom formulas."
  >
    <CampaignToolsDiceRoller />
  </CampaignListTemplate>
</template>

