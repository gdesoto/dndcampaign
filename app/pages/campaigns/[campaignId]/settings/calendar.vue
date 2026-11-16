<script setup lang="ts">
import type { CampaignAccess } from '#shared/types/campaign-workflow'
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess | null>>('campaignAccess', computed(() => null))
const canManageCalendar = computed(() => Boolean(campaignAccess.value?.permissions.includes('campaign.update')))
</script>

<template>
  <CampaignSettingsCalendarGeneralSettings :campaign-id="campaignId" :can-edit="canManageCalendar" />
</template>
