<script setup lang="ts">
import ListItem from '../../../components/kit/ListItem.vue';
const { courses, students } = useDemo();
const { liveSections } = useAcademics();
const route = useRoute();
const search = ref('');
const course = computed(() => courses.value.find(c => c.id === route.params.id));
const enrolled = computed(() => students.value.filter(s => course.value?.studentIds.includes(s.id) && (s.name + s.email).toLowerCase().includes(search.value.toLowerCase())));
function sectionsFor(id: string) { return liveSections.value.filter(s => s.courseId === course.value?.id && s.studentIds.includes(id)).map(s => s.name).join(', ') || 'Not assigned'; }
</script>
<template>
  <UCard>
    <template #header><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-sm font-semibold">Students <span class="ml-1 text-xs font-normal text-muted">{{ course?.studentIds.length }}</span></h2><div class="flex flex-wrap gap-2"><UInput
v-model="search"
icon="i-lucide-search"
placeholder="Search students…"
aria-label="Search students" /><UButton
v-if="course"
label="Manage students"
icon="i-lucide-users"
color="neutral"
variant="outline"
:to="{ query: { edit: course.id } }" /></div></div></template>
    <UTable
v-if="enrolled.length"
:data="enrolled"
:columns="[{ accessorKey: 'name', header: 'Student' }, { accessorKey: 'email', header: 'Email' }, { accessorKey: 'year', header: 'Year', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } }, { id: 'section', header: 'Section' }]"
class="hidden md:block"><template #name-cell="{ row }"><div class="flex items-center gap-2"><UAvatar :alt="row.original.name" size="xs" /><span class="font-semibold text-highlighted">{{ row.original.name }}</span></div></template><template #section-cell="{ row }">{{ sectionsFor(row.original.id) }}</template></UTable>
    <div v-if="enrolled.length" class="md:hidden"><ListItem
v-for="student in enrolled"
:key="student.id"
:title="student.name"
:description="student.email"><template #leading><UAvatar :alt="student.name" size="sm" /></template><template #metadata>Year {{ student.year }} · {{ sectionsFor(student.id) }}</template></ListItem></div>
    <UEmpty
v-else
:icon="search ? 'i-lucide-search-x' : 'i-lucide-users'"
:title="search ? 'No matches' : 'No students enrolled'"
:actions="search ? [{ label: 'Clear search', variant: 'outline', color: 'neutral', onClick: () => search = '' }] : []" />
  </UCard>
</template>
