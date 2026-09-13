<script setup lang="ts">
import { z } from 'zod';
import EntityForm from '../kit/EntityForm.vue';
import type { Section } from '../../utils/academicRules';
import { publicationBlocker } from '../../utils/academicRules';
const props = defineProps<{ open: boolean; section?: Section; courseId?: string }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const { courses } = useDemo();
const { sections, enrollment } = useAcademics();
const toast = useToast();
const state = reactive({ courseId: '', name: '', instructor: '', room: '', schedule: '', capacity: 12 });
watch(() => props.open, value => {
  if (!value) return;
  const course = courses.value.find(c => c.id === props.courseId) || courses.value.find(c => c.status === 'Active');
  Object.assign(state, props.section || { courseId: course?.id || '', name: '', instructor: course?.instructor || '', room: '', schedule: '', capacity: 12 });
}, { immediate: true });
const schema = z.object({ courseId: z.string().min(1, 'Choose a course'), name: z.string().trim().min(1, 'Enter a section name'), instructor: z.string().trim(), room: z.string().trim(), schedule: z.string().trim().min(1, 'Enter a meeting time'), capacity: z.number().int().min(1).max(200) });
function save() {
  const data = schema.parse(state);
  if (!courses.value.some(c => c.id === data.courseId)) throw new Error('This course is unavailable.');
  if (sections.value.some(s => s.courseId === data.courseId && s.name.toLowerCase() === data.name.toLowerCase() && s.id !== props.section?.id)) throw new Error('This course already has a section with that name.');
  if (props.section) {
    const index = sections.value.findIndex(s => s.id === props.section?.id);
    if (index < 0) throw new Error('This section is unavailable.');
    const updated = { ...props.section, ...data };
    if (publicationBlocker(updated, enrollment(props.section))) updated.published = false;
    sections.value[index] = updated;
  } else sections.value.push({ id: crypto.randomUUID(), ...data, studentIds: [], published: false });
  toast.add({ title: `Saved ${data.name}`, color: 'success' });
}
</script>
<template>
  <EntityForm
:focus-fallback="focusDemoHeading"
:open="open"
:title="section ? 'Edit section' : 'New section'"
:mode="section ? 'edit' : 'create'"
:state="state"
:schema="schema"
:valid="schema.safeParse(state).success"
:save="save"
:submit-label="section ? 'Save changes' : 'Create section'"
@update:open="emit('update:open', $event)">
    <UFormField
label="Course"
name="courseId"
required
:help="section ? 'A section stays with its course. Create a new section to move it.' : undefined"><USelect
v-model="state.courseId"
:items="courses.map(c => ({ label: c.name, value: c.id }))"
:disabled="!!section"
class="w-full" /></UFormField>
    <UFormField label="Section name" name="name" required><UInput
v-model="state.name"
autofocus
class="w-full"
placeholder="Section C" /></UFormField>
    <div class="grid gap-3 sm:grid-cols-2"><UFormField label="Instructor" name="instructor"><UInput v-model="state.instructor" class="w-full" placeholder="Unassigned" /></UFormField><UFormField label="Room" name="room"><UInput v-model="state.room" class="w-full" placeholder="Unassigned" /></UFormField><UFormField label="Meets" name="schedule" required><UInput v-model="state.schedule" class="w-full" placeholder="Tue, Thu · 10:00" /></UFormField><UFormField label="Capacity" name="capacity" required><UInputNumber
v-model="state.capacity"
:min="1"
:max="200"
class="w-full" /></UFormField></div>
  </EntityForm>
</template>
