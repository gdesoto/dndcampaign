<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import ConfirmButton from "./ConfirmButton.vue";
const props = defineProps<{
  name: string;
  to?: string;
  edit?: () => void;
  duplicate?: () => void;
  archive?: () => unknown;
  remove?: () => unknown;
  archived?: boolean;
  deleteDescription?: string;
  focusFallback?: () => void;
}>();
const deleteOpen = ref(false);
const pendingAction = ref<"delete">();
const menuTrigger = ref<{ $el: HTMLElement } | null>(null);
function afterMenuClose(event: Event) {
  if (!pendingAction.value) return;
  event.preventDefault();
  pendingAction.value = undefined;
  requestAnimationFrame(() => {
    deleteOpen.value = true;
  });
}
watch(deleteOpen, async (value, previous) => {
  if (!value && previous) {
    await nextTick();
    const target = menuTrigger.value?.$el;
    if (target?.isConnected) target.focus();
    else props.focusFallback?.();
  }
});
const items = computed(() => [
  [
    ...(props.to
      ? [{ label: "Open", icon: "i-lucide-arrow-up-right", to: props.to }]
      : []),
    ...(props.edit ? [{ label: "Edit", icon: "i-lucide-pencil", onSelect: props.edit }] : []),
    ...(props.duplicate ? [{ label: "Duplicate", icon: "i-lucide-copy", onSelect: props.duplicate }] : []),
    ...(props.archive ? [{
      label: "Archive",
      icon: "i-lucide-archive",
      disabled: props.archived,
      onSelect: props.archive,
    }] : []),
  ],
  props.remove ? [
    {
      label: "Delete",
      icon: "i-lucide-trash-2",
      color: "error" as const,
      onSelect: () => {
        pendingAction.value = "delete";
      },
    },
  ] : [],
].filter(group => group.length));
</script>
<template>
  <div v-if="items.length" class="flex items-center">
    <UDropdownMenu
:items="items"
:content="{ align: 'end', onCloseAutoFocus: afterMenuClose }"
      ><UTooltip :text="'Actions for ' + name"><UButton
        ref="menuTrigger"
        icon="i-lucide-ellipsis-vertical"
        :aria-label="'Actions for ' + name"
        color="neutral"
        variant="ghost"
    /></UTooltip></UDropdownMenu>
    <ConfirmButton
      v-if="deleteOpen && remove"
      v-model="deleteOpen"
      :title="'Delete ' + name + '?'"
      :description="deleteDescription || 'Delete this record?'"
      :action="remove"
      :focus-fallback="focusFallback"
    />
  </div>
</template>
