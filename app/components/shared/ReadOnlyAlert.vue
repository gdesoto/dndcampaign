<script setup lang="ts">
withDefaults(
  defineProps<{
    description: string
    title?: string
  }>(),
  {
    title: 'Read-only access',
  }
)
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    :title="title"
    :description="description"
  />
</template>
