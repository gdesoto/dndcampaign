<script setup lang="ts">
import { z } from 'zod';
import EntityForm from '../../components/kit/EntityForm.vue';
const route = useRoute();
const toast = useToast();
const record = useState<{ name: string; description: string } | null>('page-form-example', () => ({ name: 'Community workshop', description: 'Plan a welcoming introduction.' }));
const create = computed(() => route.query.new === '1');
const state = reactive({ name: '', description: '' });
watch([create, record], () => Object.assign(state, create.value ? { name: '', description: '' } : record.value || { name: '', description: '' }), { immediate: true });
const schema = z.object({ name: z.string().trim().min(1, 'Enter a name'), description: z.string() });
const failDelete = ref(false);
const failSave = ref(false);
const showDelete = ref(true);
const provideDeleteAction = ref(true);
function save() {
  if (failSave.value) throw new Error('Unable to save. Your input is preserved.');
  record.value = schema.parse(state);
  toast.add({ title: `Saved ${state.name}`, color: 'success' });
}
function remove() {
  if (failDelete.value) throw new Error('Unable to delete. Try again.');
  record.value = null;
  toast.add({ title: 'Workshop deleted', color: 'success' });
}
function cancel() { void navigateTo('/gallery/components'); }
useHead({ title: 'Page form' });
</script>
<template>
  <div class="max-w-2xl space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h2 tabindex="-1" data-focus-fallback class="text-sm font-semibold">{{ create ? 'New workshop' : record ? 'Edit workshop' : 'Workshop deleted' }}</h2>
      <UButton
v-if="!create"
label="New workshop"
to="/gallery/forms?new=1"
color="neutral"
variant="outline" />
    </div>
    <p class="text-sm text-muted">The page owns the heading and navigation. EntityForm supplies the same fields, validation, confirmation, and footer as its modal presentation.</p>
    <div class="flex flex-wrap gap-3"><USwitch v-model="failSave" label="Simulate save failure" /><USwitch v-model="failDelete" label="Simulate delete failure" /><USwitch v-model="showDelete" label="Show delete" /><USwitch v-model="provideDeleteAction" label="Provide delete action" /></div>
    <EntityForm
v-if="create || record"
:key="create ? 'new' : 'edit'"
:focus-fallback="focusDemoHeading"
presentation="page"
      :title="create ? 'New workshop' : 'Edit workshop'"
:mode="create ? 'create' : 'edit'"
      :state="state"
:schema="schema"
:valid="schema.safeParse(state).success"
:save="save"
      :submit-label="create ? 'Create workshop' : 'Save changes'"
      :show-delete="showDelete"
:delete-action="provideDeleteAction ? remove : undefined"
:delete-title="'Delete ' + (record?.name || 'workshop') + '?'"
      @cancelled="cancel"
@saved="create && navigateTo('/gallery/forms')">
      <template #default="{ pending }">
        <UFormField label="Name" name="name" required><UInput v-model="state.name" :disabled="pending" class="w-full" /></UFormField>
        <UFormField label="Description" name="description"><UTextarea v-model="state.description" :disabled="pending" class="w-full" /></UFormField>
      </template>
    </EntityForm>
    <UEmpty
v-else
icon="i-lucide-trash-2"
title="Workshop deleted"
:actions="[{ label: 'New workshop', to: '/gallery/forms?new=1' }]" />
    <p class="text-xs text-muted">Copy contract: presentation="page" omits the modal. Handle cancelled/deleted for navigation or an empty state; saved keeps a page form mounted with a clean baseline. Delete appears only for edit + showDelete + deleteAction. Copy EntityFormContainer.vue and ConfirmButton.vue with EntityForm.vue.</p>
  </div>
</template>
