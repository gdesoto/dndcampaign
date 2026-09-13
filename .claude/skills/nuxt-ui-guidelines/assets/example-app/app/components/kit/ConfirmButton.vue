<script setup lang="ts">
import { ref, nextTick, computed } from "vue";
const props = withDefaults(
  defineProps<{
    title: string;
    description: string;
    action: () => Promise<unknown> | unknown;
    label?: string;
    icon?: string;
    confirmLabel?: string;
    disabled?: boolean;
    tooltip?: string;
    tone?: "error" | "primary";
    triggerColor?: "neutral" | "error";
    modelValue?: boolean;
    focusFallback?: () => void;
  }>(),
  {
    focusFallback: undefined,
    label: undefined,
    tooltip: undefined,
    modelValue: undefined,
    icon: "i-lucide-trash-2",
    confirmLabel: "Delete",
    tone: "error",
    // Neutral by default: the color belongs on the commit button inside the
    // confirmation, not on every trigger sitting in a row.
    triggerColor: "neutral",
  },
);
const emit = defineEmits<{
  completed: [];
  "update:modelValue": [value: boolean];
}>();
const internalOpen = ref(false);
const pending = ref(false);
const error = ref("");
const trigger = ref<{ $el: HTMLElement } | null>(null);
const cancel = ref<{ $el: HTMLElement } | null>(null);
function focusCancel(event: Event) {
  event.preventDefault();
  void nextTick(() => cancel.value?.$el.focus());
}
const opened = computed({
  get: () => props.modelValue ?? internalOpen.value,
  set: (value) => {
    internalOpen.value = value;
    emit("update:modelValue", value);
    if (value) error.value = "";
  },
});
async function execute() {
  if (pending.value) return;
  pending.value = true;
  error.value = "";
  try {
    await props.action();
    opened.value = false;
    emit("completed");
    await nextTick();
    if (trigger.value?.$el?.isConnected) trigger.value.$el.focus();
    else props.focusFallback?.();
  } catch (e) {
    error.value =
      e instanceof Error
        ? e.message
        : "Unable to complete this action. Try again.";
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <UPopover
    v-model:open="opened"
    :dismissible="!pending"
    :content="{ align: 'end', onOpenAutoFocus: focusCancel }"
    :ui="{ content: 'p-4 w-72 max-w-[calc(100vw-2rem)]' }"
  >
    <UTooltip :text="tooltip" :disabled="!tooltip"><UButton
      ref="trigger"
      :icon="icon"
      :label="label"
      :aria-label="title"
      :disabled="disabled || pending"
      :color="triggerColor"
      variant="ghost"
    /></UTooltip>
    <template #content>
      <div role="group" :aria-label="title" class="space-y-3">
        <p class="font-semibold text-highlighted">{{ title }}</p>
        <p class="text-sm text-muted">{{ description }}</p>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          role="alert"
        />
        <div class="flex justify-end gap-2">
          <UButton
            ref="cancel"
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="pending"
            @click="opened = false"
          />
          <UButton
            :label="confirmLabel"
            :color="tone"
            :loading="pending"
            @click="execute"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
