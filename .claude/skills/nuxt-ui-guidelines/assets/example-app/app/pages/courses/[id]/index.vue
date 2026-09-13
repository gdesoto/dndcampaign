<script setup lang="ts">
import DetailPanel from '../../../components/kit/DetailPanel.vue';
import InlineStatus from '../../../components/kit/InlineStatus.vue';
import ListItem from '../../../components/kit/ListItem.vue';
const { courses, students } = useDemo();
const { liveSections, assessments, requestRows, enrollment, sectionIssue } = useAcademics();
const route = useRoute();
const course = computed(() => courses.value.find(c => c.id === route.params.id));
const enrolled = computed(() => students.value.filter(s => course.value?.studentIds.includes(s.id)));
const sections = computed(() => liveSections.value.filter(s => s.courseId === course.value?.id));
const upcoming = computed(() => assessments.value.filter(a => a.courseId === course.value?.id).sort((a,b) => a.dueOn.localeCompare(b.dueOn)).slice(0,3));
const pending = computed(() => requestRows.value.filter(r => r.course?.id === course.value?.id).length);
function date(value: string) { return new Date(value + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
</script>
<template>
  <div v-if="course" class="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
    <div class="space-y-3">
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-sm font-semibold">Students <span class="ml-1 text-xs font-normal text-muted">{{ enrolled.length }} enrolled</span></h2><UButton
label="Manage students"
icon="i-lucide-users"
color="neutral"
variant="ghost"
:to="{ query: { edit: course.id } }" /></div></template>
        <UTable
v-if="enrolled.length"
class="hidden md:block"
:data="enrolled.slice(0,5)"
:columns="[{ accessorKey: 'name', header: 'Student' }, { accessorKey: 'year', header: 'Year', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } }, { id: 'section', header: 'Section' }]">
          <template #name-cell="{ row }"><div class="flex items-center gap-2"><UAvatar :alt="row.original.name" size="xs" /><span class="font-semibold text-highlighted">{{ row.original.name }}</span></div></template><template #section-cell="{ row }">{{ sections.filter(s => s.studentIds.includes(row.original.id)).map(s => s.name).join(', ') || 'Not assigned' }}</template>
        </UTable>
        <div v-if="enrolled.length" class="px-3 md:hidden"><ListItem v-for="student in enrolled.slice(0,5)" :key="student.id" :title="student.name"><template #leading><UAvatar :alt="student.name" size="xs" /></template><template #metadata>Year {{ student.year }} · {{ sections.filter(s => s.studentIds.includes(student.id)).map(s => s.name).join(', ') || 'No section' }}</template></ListItem></div>
        <UEmpty
v-else
icon="i-lucide-users"
title="No students yet"
:actions="[{ label: 'Manage students', to: { query: { edit: course.id } }, color: 'neutral', variant: 'outline' }]" />
        <template #footer><div class="flex flex-wrap justify-between gap-2"><UButton
:label="'All ' + enrolled.length + ' students'"
:to="'/courses/' + course.id + '/students'"
trailing-icon="i-lucide-chevron-right"
variant="link"
color="neutral" /><UButton
v-if="pending"
icon="i-lucide-inbox"
:label="pending + ' pending requests'"
:to="{ path: '/courses/requests', query: { course: course.id } }"
color="neutral"
variant="outline" /></div></template>
      </UCard>
      <UCard><template #header><div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">Sections <span class="text-xs font-normal text-muted">{{ sections.length }}</span></h2><UButton
label="Manage sections"
icon="i-lucide-layers"
:to="{ path: '/courses/sections', query: { course: course.id } }"
color="neutral"
variant="ghost" /></div></template>
        <ListItem
v-for="section in sections"
:key="section.id"
:title="section.name"
:to="'/courses/sections?course=' + course.id"><template #metadata>{{ section.schedule }} · {{ section.room || 'Room unassigned' }}</template><template #actions><InlineStatus v-if="sectionIssue(section)" :label="sectionIssue(section)!" color="warning" /><span class="text-xs tabular-nums">{{ enrollment(section) }}/{{ section.capacity }}</span></template></ListItem>
        <UEmpty
v-if="!sections.length"
icon="i-lucide-layers"
title="No sections yet"
:actions="[{ label: 'New section', to: { path: '/courses/sections', query: { course: course.id, new: '1' } }, color: 'neutral', variant: 'outline' }]" />
      </UCard>
      <UCard><template #header><div class="flex items-center justify-between gap-2"><h2 class="text-sm font-semibold">Assessment schedule</h2><UButton
label="All assessments"
icon="i-lucide-clipboard-list"
:to="'/courses/' + course.id + '/assessments'"
color="neutral"
variant="ghost" /></div></template><ListItem
v-for="assessment in upcoming"
:key="assessment.id"
:title="assessment.name"
:to="'/courses/' + course.id + '/assessments'"><template #metadata>{{ date(assessment.dueOn) }}</template><template #actions><span class="text-xs tabular-nums text-muted">{{ assessment.weight }}%</span></template></ListItem><UEmpty v-if="!upcoming.length" icon="i-lucide-clipboard-list" title="No assessments yet" /></UCard>
    </div>
    <div class="space-y-3">
      <DetailPanel title="Course details" :facts="[{ label: 'Credits', value: course.credits }, { label: 'Enrolment', value: course.studentIds.length }, { label: 'Status', value: course.status }, { label: 'Department', value: course.department }, { label: 'Instructor', value: course.instructor || 'Unassigned' }, { label: 'Starts', value: date(course.startsOn) }, { label: 'Section seats', value: sections.reduce((n,s) => n+s.capacity,0) }]">
        <template #actions><UTooltip text="Edit course details"><UButton
icon="i-lucide-pencil"
:aria-label="'Edit ' + course.name"
color="neutral"
variant="ghost"
:to="{ query: { edit: course.id } }" /></UTooltip></template><template #Status><InlineStatus :label="course.status" :color="statusColor(course.status)" /></template><template #Instructor><span v-if="course.instructor" class="flex items-center gap-1.5"><UAvatar :alt="course.instructor" size="3xs" />{{ course.instructor }}</span><span v-else class="text-muted">Unassigned</span></template>
      </DetailPanel>
      <UCard variant="soft"><template #header><h2 class="text-sm font-semibold">Description</h2></template><p class="text-data leading-relaxed text-muted">{{ course.description }}</p></UCard>
    </div>
  </div>
</template>
