<script setup lang="ts">
const props = defineProps<{
  title: string;
  rule: string;
  rationale: string;
  contract: string;
  source?: string;
  code: string;
}>();
const toast = useToast();
async function copy() {
  try {
    await navigator.clipboard.writeText(props.code);
    toast.add({ title: "Example copied", color: "success" });
  } catch {
    toast.add({ title: "Select and copy the example below", color: "warning" });
  }
}
</script>
<template>
  <section class="overflow-hidden rounded-md border border-default">
    <div class="border-b border-default bg-muted/30 px-4 py-3">
      <h2 class="font-mono text-sm font-medium">{{ title }}</h2>
    </div>
    <div class="grid lg:grid-cols-[1.35fr_1fr]">
    <div class="min-w-0 p-4"><slot /></div>
    <div class="min-w-0 space-y-3 border-t border-default bg-muted/30 p-4 text-data lg:border-l lg:border-t-0">
      <p class="font-mono text-xs uppercase tracking-widest text-primary">Rule</p>
      <p class="font-semibold text-highlighted">{{ rule }}</p>
      <p class="font-mono text-xs uppercase tracking-widest text-primary">Rationale</p>
      <p class="text-muted">{{ rationale }}</p>
      <p><span class="font-medium">Contract: </span>{{ contract }}</p>
      <div class="flex items-center justify-between">
        <UButton
          v-if="source"
          :to="source"
          target="_blank"
          label="Nuxt UI documentation"
          variant="link"
          size="xs"
        /><UTooltip text="Copy example"
          ><UButton
            icon="i-lucide-copy"
            aria-label="Copy example"
            color="neutral"
            variant="ghost"
            @click="copy"
        /></UTooltip>
      </div>
      <pre
        class="overflow-x-auto rounded-lg border border-default bg-default p-3 text-xs leading-relaxed"
      ><code>{{ code }}</code></pre>
    </div>
    </div>
  </section>
</template>
