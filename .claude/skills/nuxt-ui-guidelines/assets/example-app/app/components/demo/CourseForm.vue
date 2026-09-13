<script setup lang="ts">
import { z } from "zod";
import EntityForm from "../kit/EntityForm.vue";
import type { Course } from "../../composables/useDemo";
const props = defineProps<{
  open: boolean;
  course?: Course;
  duplicate?: boolean;
}>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const { students, courses } = useDemo();
const { sections } = useAcademics();
const toast = useToast();
const state = reactive({
  name: "",
  description: "",
  credits: 3,
  department: 'Science',
  instructor: '',
  startsOn: '2026-09-21',
  studentIds: [] as string[],
});
watch(
  () => props.open,
  (value) => {
    if (value)
      Object.assign(
        state,
        props.course
          ? {
              name: props.course.name + (props.duplicate ? " (copy)" : ""),
              description: props.course.description,
              credits: props.course.credits,
              department: props.course.department,
              instructor: props.course.instructor,
              startsOn: props.course.startsOn,
              studentIds: props.duplicate ? [] : [...props.course.studentIds],
            }
          : { name: "", description: "", credits: 3, studentIds: [], department: 'Science', instructor: '', startsOn: '2026-09-21' },
      );
  },
  { immediate: true },
);
const schema = z.object({
  name: z.string().trim().min(1, "Enter a course name"),
  description: z.string().trim().min(1, "Enter a description"),
  credits: z.number().int().min(1).max(12),
  department: z.string().trim().min(1, 'Choose a department'),
  instructor: z.string().trim(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
  studentIds: z.array(z.string()),
});
function save() {
  const data = schema.parse(state);
  if (props.course && !props.duplicate) {
    const index = courses.value.findIndex((c) => c.id === props.course?.id);
    if (index < 0) throw new Error("This course is no longer available.");
    courses.value[index] = { ...courses.value[index]!, ...data };
    sections.value.filter(s => s.courseId === props.course?.id).forEach(s => { s.studentIds = s.studentIds.filter(id => data.studentIds.includes(id)); });
  } else
    courses.value.unshift({
      id: crypto.randomUUID(),
      ...data,
      status: "Active",
    });
  toast.add({ title: `Saved ${data.name}`, color: "success" });
}
</script>
<template>
  <EntityForm
:focus-fallback="focusDemoHeading"
    :open="open"
    :title="course && !duplicate ? 'Edit course' : 'New course'"
    :mode="course && !duplicate ? 'edit' : 'create'"
    :state="state"
    :schema="schema"
    :save="save"
    :valid="schema.safeParse(state).success"
    :submit-label="course && !duplicate ? 'Save changes' : 'Create course'"
    @update:open="emit('update:open', $event)"
  >
    <UFormField
label="Name"
name="name"
required
      ><UInput
v-model="state.name"
autofocus
class="w-full"
    /></UFormField>
    <UFormField
label="Description"
name="description"
required
      ><UTextarea
v-model="state.description"
class="w-full"
:rows="3"
    /></UFormField>
    <div class="grid gap-3 sm:grid-cols-2"><UFormField label="Department" name="department" required><USelect v-model="state.department" :items="['Science', 'Humanities', 'Mathematics', 'Arts', 'Technology']" class="w-full" /></UFormField><UFormField label="Instructor" name="instructor"><UInput v-model="state.instructor" class="w-full" placeholder="Unassigned" /></UFormField><UFormField label="Starts" name="startsOn" required><UInput v-model="state.startsOn" type="date" class="w-full" /></UFormField>
    <UFormField
label="Credits"
name="credits"
required
      ><UInputNumber
v-model="state.credits"
:min="1"
:max="12"
class="w-full"
    /></UFormField></div>
    <UFormField
v-if="course && !duplicate"
label="Students"
name="studentIds"
      ><USelectMenu
        v-model="state.studentIds"
        :items="students.map((s) => ({ label: s.name, value: s.id }))"
        value-key="value"
        multiple
        class="w-full"
        placeholder="Select students"
    /></UFormField>
    <p v-if="!course || duplicate" class="text-xs text-muted">Students can be added after saving.</p>
  </EntityForm>
</template>
