<script setup lang="ts">
import PageHeader from "../components/kit/PageHeader.vue";
</script>
<template>
  <UDashboardPanel id="gallery">
    <template #header
      ><PageHeader
        title="Component gallery"
        :breadcrumbs="[{ label: 'Gallery' }]" /><UDashboardToolbar
        ><UNavigationMenu
          highlight
          :items="[
            { label: 'Components', to: '/gallery/components' },
            { label: 'API', to: '/gallery/api' },
            { label: 'Layout recipes', to: '/gallery/recipes' },
            { label: 'Interaction states', to: '/gallery/states' },
            { label: 'Page form', to: '/gallery/forms' },
            { label: 'Identity', to: '/gallery/identity' },
          ]" /></UDashboardToolbar
    ></template>
    <template #body><NuxtPage /></template>
  </UDashboardPanel>
</template>
