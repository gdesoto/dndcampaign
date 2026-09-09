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
    color="neutral"
    icon="i-lucide-eye"
    variant="subtle"
    :title="title"
    :description="description"
  />
</template>
