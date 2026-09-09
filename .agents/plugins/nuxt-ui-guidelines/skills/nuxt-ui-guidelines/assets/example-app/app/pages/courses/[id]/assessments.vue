<script setup lang="ts">
import { z } from 'zod';
import EntityForm from '../../../components/kit/EntityForm.vue';
import ListItem from '../../../components/kit/ListItem.vue';
const route = useRoute();
const { assessments } = useAcademics();
const { courses } = useDemo();
const toast = useToast();
const rows = computed(() => assessments.value.filter(a => a.courseId === route.params.id));
const { open, editing, form } = useQueryEditor(rows, 'assessment');
const state = reactive({ name: '', dueOn: '', weight: 10 });
watch(open, value => { if (value) Object.assign(state, editing.value || { name: '', dueOn: '2026-10-05', weight: Math.max(1, 100 - rows.value.reduce((n,a) => n+a.weight,0)) }); }, { immediate: true });
// The 100% budget is a requirement, so it is visible before submission rather
// than only in a rejected save.
const remaining = computed(() => 100 - rows.value.filter(a => a.id !== editing.value?.id).reduce((n, a) => n + a.weight, 0));
const schema = z.object({ name: z.string().trim().min(1, 'Enter an assessment name'), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'), weight: z.number().int().min(1).max(100) });
function save() {
  const data = schema.parse(state);
  if (!courses.value.some(c => c.id === route.params.id)) throw new Error('This course is unavailable.');
  const others = rows.value.filter(a => a.id !== editing.value?.id).reduce((n,a) => n+a.weight,0);
  if (others + data.weight > 100) throw new Error(`Total weight cannot exceed 100%. ${100-others}% is available.`);
  if (editing.value) Object.assign(editing.value, data);
  else assessments.value.push({ id: crypto.randomUUID(), courseId: String(route.params.id), ...data });
  toast.add({ title: `Saved ${data.name}`, color: 'success' });
}
function date(value: string) { return new Date(value + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
</script>
<template>
  <UCard><template #header><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex items-center gap-2"><h2 class="text-sm font-semibold">Assessments</h2><UBadge :color="rows.reduce((n,a) => n+a.weight, 0) === 100 ? 'neutral' : 'warning'">{{ rows.reduce((n,a) => n+a.weight, 0) }}% total</UBadge></div><UButton label="New assessment" icon="i-lucide-plus" @click="form()" /></div></template>
    <UTable
v-if="rows.length"
:data="rows"
:columns="[{ accessorKey: 'name', header: 'Assessment' }, { accessorKey: 'dueOn', header: 'Due' }, { accessorKey: 'weight', header: 'Weight', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } }, { id: 'actions', header: '', meta: { class: { th: 'w-px whitespace-nowrap px-2', td: 'w-px whitespace-nowrap px-2' } } }]"
class="hidden md:block"><template #name-cell="{ row }"><span class="font-semibold text-highlighted">{{ row.original.name }}</span></template><template #dueOn-cell="{ row }">{{ date(row.original.dueOn) }}</template><template #weight-cell="{ row }">{{ row.original.weight }}%</template><template #actions-cell="{ row }"><UButton
icon="i-lucide-pencil"
:aria-label="'Edit ' + row.original.name"
color="neutral"
variant="ghost"
@click="form(row.original)" /></template></UTable>
    <div v-if="rows.length" class="md:hidden"><ListItem v-for="assessment in rows" :key="assessment.id" :title="assessment.name"><template #metadata><span>{{ date(assessment.dueOn) }}</span><span class="tabular-nums">{{ assessment.weight }}%</span></template><template #actions><UButton
icon="i-lucide-pencil"
:aria-label="'Edit ' + assessment.name"
color="neutral"
variant="ghost"
@click="form(assessment)" /></template></ListItem></div><UEmpty v-else icon="i-lucide-clipboard-list" title="No assessments yet" />
    <EntityForm
v-model:open="open"
:focus-fallback="focusDemoHeading"
:title="editing ? 'Edit assessment' : 'New assessment'"
:mode="editing ? 'edit' : 'create'"
:state="state"
:schema="schema"
:save="save"
:valid="schema.safeParse(state).success"
:submit-label="editing ? 'Save changes' : 'Create assessment'"><UFormField label="Name" name="name" required><UInput v-model="state.name" autofocus class="w-full" /></UFormField><div class="grid gap-3 sm:grid-cols-2"><UFormField label="Due" name="dueOn" required><UInput v-model="state.dueOn" type="date" class="w-full" /></UFormField><UFormField
label="Weight (%)"
name="weight"
required
:help="remaining >= 0 ? remaining + '% of the course total is available' : Math.abs(remaining) + '% over the course total'"><UInputNumber
v-model="state.weight"
:min="1"
:max="100"
class="w-full" /></UFormField></div></EntityForm>
  </UCard>
</template>
