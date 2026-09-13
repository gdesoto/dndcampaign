<script setup lang="ts">
import PageHeader from '../../components/kit/PageHeader.vue';
import ListItem from '../../components/kit/ListItem.vue';
import InlineStatus from '../../components/kit/InlineStatus.vue';
import ConfirmButton from '../../components/kit/ConfirmButton.vue';
import StatCard from '../../components/kit/StatCard.vue';
const { requestRows, approve, decline } = useAcademics();
const search = ref('');
const route = useRoute();
const toast = useToast();
const scoped = computed(() => requestRows.value.filter(r => !route.query.course || r.course?.id === route.query.course));
const matched = computed(() => scoped.value.filter(r => `${r.student?.name} ${r.course?.name}`.toLowerCase().includes(search.value.toLowerCase())));
const groups = computed(() => [
  { label: 'Ready to enroll', value: 'ready', rows: matched.value.filter(r => !r.blocker) },
  { label: 'Waiting for seats', value: 'capacity', rows: matched.value.filter(r => r.blocker === 'Section full') },
  { label: 'Needs review', value: 'review', rows: matched.value.filter(r => r.blocker && r.blocker !== 'Section full') }
]);
const totals = computed(() => [...new Set(scoped.value.map(r => r.course!.id))].map(id => ({ id, name: scoped.value.find(r => r.course!.id === id)!.course!.name, count: scoped.value.filter(r => r.course!.id === id).length })).sort((a,b) => b.count-a.count));
function enroll(row: { id: string; blocker?: string }) {
  if (row.blocker) return;
  try { approve(row.id); focusDemoHeading(); }
  catch (e) { toast.add({ title: e instanceof Error ? e.message : 'Unable to enroll', color: 'error', duration: 0 }); }
}
useHead({ title: 'Enrollment requests' });
</script>
<template>
  <UDashboardPanel id="course-requests"><template #header><PageHeader title="Requests" :count="scoped.length + ' pending'" :breadcrumbs="[{ label: 'Courses', to: '/courses' }, { label: 'Requests' }]" /></template>
    <template #body>
      <div class="grid grid-cols-3 gap-2 sm:gap-3"><StatCard
icon="i-lucide-check-check"
label="Ready to enroll"
:value="scoped.filter(r => !r.blocker).length" /><StatCard
icon="i-lucide-hourglass"
label="Waiting for seats"
:value="scoped.filter(r => r.blocker === 'Section full').length" /><StatCard
icon="i-lucide-circle-alert"
label="Needs review"
:value="scoped.filter(r => r.blocker && r.blocker !== 'Section full').length"
:tone="scoped.some(r => r.blocker && r.blocker !== 'Section full') ? 'warning' : 'neutral'" /></div>
      <div class="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
        <UCard><template #header><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-sm font-semibold">Enrollment queue</h2><UInput
v-model="search"
icon="i-lucide-search"
placeholder="Search requests…"
aria-label="Search requests"
class="w-full sm:w-56" /></div></template>
          <UAccordion
v-if="matched.length"
:items="groups"
type="multiple"
:default-value="['ready', 'capacity', 'review']"><template #trailing="{ item }"><UBadge color="neutral">{{ item.rows.length }}</UBadge></template><template #body="{ item }"><div class="border-l border-default pl-2 sm:pl-3"><ListItem v-for="row in item.rows" :key="row.id" :title="row.student!.name"><template #leading><UAvatar :alt="row.student!.name" size="sm" /></template><template #metadata><NuxtLink :to="'/courses/' + row.course!.id" class="hover:text-primary">{{ row.course!.name }} · {{ row.section!.name }}</NuxtLink><InlineStatus :label="row.blocker || 'Eligible'" :color="row.blocker ? 'warning' : 'success'" /></template><template #actions><UTooltip :text="row.blocker ? row.blocker + ' — cannot enroll yet' : 'Approve'"><UButton
icon="i-lucide-check"
:aria-label="'Approve ' + row.student!.name + (row.blocker ? ' — ' + row.blocker : '')"
:aria-disabled="row.blocker ? 'true' : undefined"
class="aria-disabled:opacity-50"
color="success"
variant="ghost"
@click="enroll(row)" /></UTooltip><ConfirmButton
trigger-color="error"
:focus-fallback="focusDemoHeading"
:title="'Decline ' + row.student!.name + '?'"
:description="'Remove the request for ' + row.course!.name + '. This cannot be undone.'"
icon="i-lucide-x"
confirm-label="Decline"
:action="() => decline(row.id)" /></template></ListItem><p v-if="!item.rows.length" class="py-2 text-xs text-muted">No requests</p></div></template></UAccordion>
          <UEmpty
v-else
:icon="search ? 'i-lucide-search-x' : 'i-lucide-check-check'"
:title="search ? 'No matches' : 'All requests reviewed'"
:actions="search ? [{ label: 'Clear search', color: 'neutral', variant: 'outline', onClick: () => search = '' }] : []" />
        </UCard>
        <div class="space-y-3"><UCard variant="soft"><template #header><h2 class="text-sm font-semibold">Requests by course</h2></template><ListItem
v-for="total in totals"
:key="total.id"
:title="total.name"
:to="'/courses/' + total.id"><template #actions><span class="text-xs tabular-nums text-muted">{{ total.count }}</span></template></ListItem><p v-if="!totals.length" class="text-xs text-muted">No pending requests</p><template v-if="route.query.course" #footer><UButton
label="All requests"
icon="i-lucide-inbox"
to="/courses/requests"
color="neutral"
variant="link" /></template></UCard>
          <UCard v-if="scoped.some(r => r.blocker === 'Section full')" variant="soft" class="border-l-2 border-warning"><div class="flex items-center justify-between gap-3"><div><h2 class="text-sm font-semibold">More seats needed</h2><p class="mt-1 text-xs text-muted">Review capacity before enrolling waiting students.</p><UButton
label="Review sections"
icon="i-lucide-layers"
to="/courses/sections"
color="neutral"
variant="outline"
class="mt-3" /></div><span class="text-metric font-semibold tabular-nums">{{ scoped.filter(r => r.blocker === 'Section full').length }}</span></div></UCard></div>
      </div>
    </template>
  </UDashboardPanel>
</template>
