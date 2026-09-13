<script setup lang="ts">
import PageHeader from '../../components/kit/PageHeader.vue';
import StatCard from '../../components/kit/StatCard.vue';
import ListItem from '../../components/kit/ListItem.vue';
import SectionCard from '../../components/demo/SectionCard.vue';
import SectionForm from '../../components/demo/SectionForm.vue';
const { courses } = useDemo();
const { sections, liveSections, enrollment, sectionIssue, courseFor } = useAcademics();
const route = useRoute();
const router = useRouter();
const { open, editing, form } = useQueryEditor(sections);
const courseFilter = computed({ get: () => String(route.query.course || 'all'), set: value => { void router.replace({ query: { ...route.query, course: value === 'all' ? undefined : value } }); } });
const scoped = computed(() => liveSections.value.filter(s => courseFilter.value === 'all' || s.courseId === courseFilter.value));
const blocked = computed(() => scoped.value.filter(s => sectionIssue(s)));
const visible = computed(() => route.query.view === 'attention' ? blocked.value : scoped.value);
const seats = computed(() => scoped.value.reduce((n,s) => n + s.capacity, 0));
const filled = computed(() => scoped.value.reduce((n,s) => n + enrollment(s), 0));
const unstaffed = computed(() => scoped.value.filter(s => !s.instructor.trim()));
const busy = computed(() => [...scoped.value].sort((a,b) => enrollment(b)/b.capacity - enrollment(a)/a.capacity).slice(0,3));
useHead({ title: 'Course sections' });
</script>
<template>
  <UDashboardPanel id="course-sections"><template #header><PageHeader title="Sections" :count="scoped.length + ' sections'" :breadcrumbs="[{ label: 'Courses', to: '/courses' }, { label: 'Sections' }]"><template #actions><UButton label="New section" icon="i-lucide-plus" @click="form()" /></template></PageHeader></template>
    <template #body>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3"><StatCard
icon="i-lucide-users"
label="Seats filled"
:value="filled + ' of ' + seats"
:progress="seats ? Math.min(filled / seats * 100, 100) : 0" /><StatCard
icon="i-lucide-door-open"
label="Rooms in use"
:value="new Set(scoped.map(s => s.room).filter(Boolean)).size"
:delta="scoped.length + ' sections'" /><StatCard
class="col-span-2 sm:col-span-1"
icon="i-lucide-user-x"
label="Unstaffed sections"
:value="unstaffed.length"
:tone="unstaffed.length ? 'warning' : 'neutral'"><div v-for="section in unstaffed.slice(0,2)" :key="section.id" class="flex items-center justify-between gap-2 text-xs"><NuxtLink :to="{ query: { ...route.query, edit: section.id } }" class="truncate hover:text-primary">{{ courseFor(section)?.name }} · {{ section.name }}</NuxtLink><span class="text-warning">Unassigned</span></div></StatCard></div>
      <div class="flex flex-wrap items-center gap-2"><USelect
v-model="courseFilter"
:items="[{ label: 'All courses', value: 'all' }, ...courses.map(c => ({ label: c.name, value: c.id }))]"
aria-label="Filter sections by course"
class="w-full sm:w-64" /><UBadge
v-if="route.query.view === 'attention'"
color="warning"
variant="subtle"
icon="i-lucide-filter">Needs attention</UBadge><UButton
v-if="route.query.view === 'attention'"
label="Show all sections"
icon="i-lucide-filter-x"
color="neutral"
variant="outline"
:to="{ query: { course: route.query.course } }" /><span class="ml-auto text-xs text-muted">{{ visible.length }} shown</span></div>
      <div class="grid items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-3"><SectionCard
v-for="section in visible"
:key="section.id"
:section="section"
@edit="form($event)" /><UCard :ui="{ root: 'border border-dashed border-default ring-0', body: 'flex h-full min-h-32 flex-col items-center justify-center gap-3 p-4 text-center' }"><p class="max-w-60 text-data text-muted">Create another section for a new meeting time or more seats.</p><UButton
label="Add section"
icon="i-lucide-plus"
color="neutral"
variant="outline"
@click="form()" /></UCard></div>
      <div class="grid items-start gap-3 lg:grid-cols-2"><UCard variant="soft"><template #header><h2 class="text-sm font-semibold">Highest occupancy</h2></template><ListItem
v-for="section in busy"
:key="section.id"
:title="courseFor(section)?.name || 'Course'"
:to="'/courses/' + section.courseId"><template #metadata>{{ section.name }} · {{ section.room || 'No room' }}</template><template #actions><span class="text-xs tabular-nums" :class="enrollment(section) > section.capacity ? 'text-error' : 'text-muted'">{{ enrollment(section) }} / {{ section.capacity }}</span></template></ListItem><UEmpty v-if="!busy.length" icon="i-lucide-layers" title="No sections yet" /></UCard>
        <UCard variant="soft" :class="blocked.length ? 'border-l-2 border-warning' : ''"><div class="flex items-center justify-between gap-4"><div><h2 class="text-sm font-semibold">{{ blocked.length ? 'Before sections can publish' : 'Ready for the term' }}</h2><p class="mt-1 text-xs text-muted">{{ blocked.length ? 'Resolve staffing, room, or capacity issues.' : 'No staffing, room, or capacity issues.' }}</p><UButton
v-if="blocked.length"
label="Review sections"
icon="i-lucide-layers"
:to="{ query: { course: route.query.course, view: 'attention' } }"
color="neutral"
variant="outline"
class="mt-3" /><UButton
v-else
label="Review requests"
icon="i-lucide-inbox"
to="/courses/requests"
color="neutral"
variant="outline"
class="mt-3" /></div><div class="shrink-0 text-right"><p class="text-metric font-semibold tabular-nums">{{ blocked.length }}</p><p class="text-xs text-muted">blocked</p></div></div></UCard></div>
      <SectionForm v-model:open="open" :section="editing" :course-id="courseFilter === 'all' ? undefined : courseFilter" />
    </template>
  </UDashboardPanel>
</template>
