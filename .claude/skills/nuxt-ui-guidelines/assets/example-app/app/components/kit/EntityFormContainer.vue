<script setup lang="ts">
defineProps<{ presentation: 'modal' | 'page'; open: boolean; title: string; busy: boolean }>();
defineEmits<{ close: [] }>();
</script>
<template>
  <section v-if="presentation === 'page'" :aria-label="title"><slot /></section>
  <UModal
v-else
:open="open"
:title="title"
:dismissible="!busy"
:close="!busy"
    @update:open="!$event && $emit('close')">
    <template #body><slot /></template>
  </UModal>
</template>
