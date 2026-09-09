<script setup lang="ts">
withDefaults(defineProps<{ label: string; color?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' }>(), { color: 'neutral' });
</script>
<template><UBadge :color="color" variant="subtle"><span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />{{ label }}</UBadge></template>
