<script setup lang="ts">
defineProps<{ title: string; facts: { label: string; value: string | number }[] }>();
</script>
<template>
  <UCard variant="soft">
    <template #header><div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">{{ title }}</h2><slot name="actions" /></div></template>
    <dl class="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-data">
      <template v-for="fact in facts" :key="fact.label"><dt class="text-xs text-muted">{{ fact.label }}</dt><dd class="break-words text-default"><slot :name="fact.label" :fact="fact">{{ fact.value }}</slot></dd></template>
    </dl>
    <slot />
  </UCard>
</template>
