<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import EntityFormContainer from './EntityFormContainer.vue';
import ConfirmButton from './ConfirmButton.vue';
const props = defineProps<{
  open?: boolean;
  presentation?: 'modal' | 'page';
  showDelete?: boolean;
  deleteAction?: () => Promise<unknown> | unknown;
  deleteTitle?: string;
  deleteDescription?: string;
  title: string;
  mode: "create" | "edit";
  state: Record<string, unknown>;
  schema: object;
  save: () => Promise<unknown> | unknown;
  submitLabel?: string;
  valid?: boolean;
  serializeState?: (state: Record<string, unknown>) => string;
  focusFallback?: () => void;
}>();
const emit = defineEmits<{ "update:open": [value: boolean]; saved: []; cancelled: []; deleted: [] }>();
const pending = ref(false);
const deleting = ref(false);
const deleteOpen = ref(false);
const busy = computed(() => pending.value || deleting.value);
const active = computed(() => props.presentation === 'page' || !!props.open);
const canDelete = computed(() => props.mode === 'edit' && props.showDelete === true && typeof props.deleteAction === 'function');
function finishCancel() { emit('cancelled'); if (props.presentation !== 'page') emit('update:open', false); }
async function remove() {
  if (!canDelete.value || busy.value) return;
  deleting.value = true;
  try { await props.deleteAction!(); initial.value = serializeCurrentState(); }
  finally { deleting.value = false; }
}
function deleted() { emit('deleted'); if (props.presentation !== 'page') emit('update:open', false); }
const error = ref("");
const discard = ref(false);
const initial = ref("");
// Callers can describe meaningful changes for files, maps, or other rich values.
function serializeCurrentState() {
  const serialize = props.serializeState ?? JSON.stringify;
  return serialize(props.state);
}
const dirty = computed(() => serializeCurrentState() !== initial.value);
let resolveNavigation: ((value: boolean) => void) | undefined;
const stopGuard = useRouter().beforeEach(async () => {
  if (!active.value) return true;
  if (busy.value || deleteOpen.value) return false;
  if (!dirty.value) return true;
  discard.value = true;
  return await new Promise<boolean>(resolve => { resolveNavigation = resolve; });
});
onUnmounted(() => { stopGuard(); resolveNavigation?.(false); });
function keepEditing() { discard.value = false; resolveNavigation?.(false); resolveNavigation = undefined; }
function discardChanges() {
  initial.value = serializeCurrentState();
  discard.value = false;
  if (resolveNavigation) { resolveNavigation(true); resolveNavigation = undefined; }
  else finishCancel();
}
function focusError(event: { errors: { id?: string }[] }) {
  const id = event.errors[0]?.id;
  if (id) document.getElementById(id)?.focus();
}
watch(
  () => active.value,
  (value) => {
    if (value) {
      initial.value = serializeCurrentState();
      error.value = "";
      discard.value = false;
      deleteOpen.value = false;
    }
  },
  { immediate: true },
);
function close() {
  if (busy.value || deleteOpen.value) return;
  if (dirty.value) discard.value = true;
  else finishCancel();
}
async function submit() {
  if (busy.value || deleteOpen.value) return;
  pending.value = true;
  error.value = "";
  try {
    await props.save();
    initial.value = serializeCurrentState();
    pending.value = false;
    emit("saved");
    if (props.presentation !== 'page') emit("update:open", false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to save. Try again.";
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <EntityFormContainer
    :presentation="presentation || 'modal'"
    :open="!!open"
    :title="title"
    :busy="busy"
    @close="close"
  >
      <UForm
:schema="schema"
:state="state"
class="space-y-5"
:validate-on="['blur']"
@error="focusError"
@submit="submit">
        <fieldset :disabled="busy" class="min-w-0 space-y-5"><slot :pending="busy" /></fieldset>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          role="alert"
        />
        <div v-if="discard" class="rounded-lg border border-default p-3">
          <p class="mb-3 text-sm font-medium">Discard unsaved changes?</p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Keep editing"
              color="neutral"
              variant="outline"
              @click="keepEditing"
            />
            <UButton
              label="Discard"
              color="error"
              @click="discardChanges"
            />
          </div>
        </div>
        <div class="flex items-center gap-3 border-t border-default pt-4">
          <ConfirmButton
v-if="canDelete"
v-model="deleteOpen"
            :title="deleteTitle || 'Delete record?'"
            :description="deleteDescription || 'This record will be permanently deleted. Unsaved changes will be discarded.'"
            tooltip="Delete record"
:action="remove"
:focus-fallback="focusFallback"
:disabled="busy || discard"
            @completed="deleted" />
          <div class="ml-auto flex flex-1 justify-end gap-2 sm:flex-none [&>button]:flex-1 [&>button]:justify-center sm:[&>button]:flex-none">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="busy || deleteOpen"
            @click="close"
          />
          <UButton
type="submit"
:label="submitLabel || (mode === 'edit' ? 'Save changes' : 'Create record')"
:disabled="deleting || deleteOpen || valid === false || (mode === 'edit' && !dirty)"
:loading="pending" />
          </div>
        </div>
      </UForm>
  </EntityFormContainer>
</template>
