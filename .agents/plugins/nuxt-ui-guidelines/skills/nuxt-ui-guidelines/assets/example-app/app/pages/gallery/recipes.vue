<script setup lang="ts">
import Example from '../../components/gallery/Example.vue';
import DetailPanel from '../../components/kit/DetailPanel.vue';
import StatCard from '../../components/kit/StatCard.vue';
import InlineStatus from '../../components/kit/InlineStatus.vue';
import ListItem from '../../components/kit/ListItem.vue';
import ConfirmButton from '../../components/kit/ConfirmButton.vue';
const { courses, students } = useDemo();
const { liveSections, enrollment, requestRows } = useAcademics();
const toast = useToast();
// A person row carries identity, one line of context, status, and actions.
// `enrolled` is derived from the same course records the rest of the app reads.
const people = computed(() => students.value.slice(0, 3).map(student => ({
  ...student,
  enrolled: courses.value.filter(course => course.studentIds.includes(student.id)).length,
})));
// A compact total is a label and a right-aligned count — nothing else earns a row.
const departments = computed(() => {
  const totals = new Map<string, number>();
  for (const course of courses.value) totals.set(course.department, (totals.get(course.department) ?? 0) + 1);
  return [...totals]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
});
// Capacity divides one total: seats taken, seats claimed by pending requests,
// seats still available. The segments add up to the capacity, so the bar means
// something a reader can check.
const capacity = computed(() => {
  const total = liveSections.value.reduce((sum, section) => sum + section.capacity, 0);
  const enrolled = liveSections.value.reduce((sum, section) => sum + enrollment(section), 0);
  const pending = requestRows.value.length;
  return { total, enrolled, pending, available: Math.max(0, total - enrolled - pending) };
});
const selected = ref(false);
const expanded = ref(false);
const requests = ref([
  { id: 'r1', name: 'Alex Morgan', course: 'Biology 101', eligible: true },
  { id: 'r2', name: 'Jordan Lee', course: 'Creative Writing 101', eligible: false }
]);
function decide(id: string, approved: boolean) {
  const item = requests.value.find(r => r.id === id);
  requests.value = requests.value.filter(r => r.id !== id);
  toast.add({ title: (approved ? 'Approved ' : 'Declined ') + item?.name, color: 'success' });
}
const groups = computed(() => [{ label: 'Prerequisite review', value: 'prerequisite', requests: requests.value.filter(r => !r.eligible) }, { label: 'Ready to enroll', value: 'ready', requests: requests.value.filter(r => r.eligible) }]);
const snippets = [
  "<DetailPanel :title=\"entity.name\" :facts=\"[{ label: 'Credits', value: entity.credits }]\">\n  <template #actions><UButton icon=\"i-lucide-pencil\" aria-label=\"Edit course\" variant=\"ghost\" /></template>\n</DetailPanel>",
  "<!-- Icons name the metric's subject; use them for every card in a row or none. -->\n<StatCard icon=\"i-lucide-users\" label=\"Seats filled\" value=\"86%\" :progress=\"86\" />\n<StatCard icon=\"i-lucide-door-open\" label=\"Rooms in use\" value=\"11 of 14\" delta=\"3 available\" />",
  "<UCard><ListItem v-for=\"item in topItems\" :key=\"item.id\" :title=\"item.name\" :to=\"item.url\"><template #actions>{{ item.count }}</template></ListItem><template #footer><UButton to=\"/records\" label=\"All records\" variant=\"link\" /></template></UCard>",
  "<UCard :ui=\"{ root: 'border border-dashed border-default ring-0' }\"><p>Make room for another course.</p><UButton label=\"New course\" to=\"/courses?new=1\" variant=\"outline\" color=\"neutral\" /></UCard>",
  "<div class=\"grid gap-4 xl:grid-cols-[2fr_1fr]\"><UCard><!-- related records --></UCard><DetailPanel title=\"Details\" :facts=\"facts\" /></div>",
  "<ListItem :title=\"event.title\"><template #leading><UIcon :name=\"event.icon\" /></template><template #metadata>{{ event.actor }} · {{ event.time }}</template></ListItem>",
  "<ListItem :title=\"request.name\"><template #leading><UAvatar :alt=\"request.name\" /></template><template #actions><UButton icon=\"i-lucide-check\" aria-label=\"Approve request\" :disabled=\"!request.eligible\" variant=\"ghost\" /><ConfirmButton title=\"Decline request?\" description=\"The request will be removed.\" confirm-label=\"Decline\" icon=\"i-lucide-x\" :action=\"decline\" /></template></ListItem>",
  "<UAccordion :items=\"groups\"><template #trailing=\"{ item }\"><UBadge color=\"neutral\">{{ item.records.length }}</UBadge></template><template #body=\"{ item }\"><ListItem v-for=\"record in item.records\" :key=\"record.id\" :title=\"record.name\" /></template></UAccordion>",
  "<ListItem v-model:selected=\"selected\" v-model:expanded=\"expanded\" title=\"Biology 101\" selectable expandable><template #metadata>3 credits · 12 students</template><template #expanded>Related students</template></ListItem>",
  "<UCard><template #header>{{ session.title }}</template><p>{{ session.scheduledAt }}</p><template #footer><UAvatarGroup><!-- participants --></UAvatarGroup></template></UCard>",
  "<!-- UUser is the person recipe: identity, one line of context, then status and actions. -->\n<UUser :name=\"person.name\" :description=\"person.email\" :avatar=\"{ alt: person.name }\" size=\"sm\" />\n<InlineStatus :label=\"person.enrolled ? 'Enrolled' : 'No courses'\" :color=\"person.enrolled ? 'success' : 'warning'\" />",
  "<UCard><div v-for=\"total in totals\" :key=\"total.label\" class=\"flex items-baseline justify-between gap-4 py-1\"><span class=\"text-muted\">{{ total.label }}</span><span class=\"font-medium tabular-nums\">{{ total.count }}</span></div></UCard>",
  "<StatCard label=\"Section seats\" :value=\"capacity.enrolled + ' of ' + capacity.total\" :delta=\"capacity.available + ' available'\" :max=\"capacity.total\" :segments=\"[\n  { label: 'Enrolled', value: capacity.enrolled, color: 'primary' },\n  { label: 'Pending requests', value: capacity.pending, color: 'warning' },\n  { label: 'Available', value: capacity.available, color: 'neutral' }\n]\" />"
];
useHead({ title: 'Layout recipes' });
</script>
<template>
  <div class="space-y-6">
    <p class="max-w-3xl text-data text-muted">Choose a composition for the relationship it reveals. These examples use fictional records; preview actions affect only the preview.</p>
    <Example
title="Entity card · header / facts / footer"
rule="Identity and status first, aligned facts second, quiet actions last."
rationale="A consistent label column makes different records easy to scan without turning every fact into a separate box."
contract="UCard header/body/footer; DetailPanel title, facts[], actions and named fact slots. Dependencies: UCard, UBadge, UButton. No demo dependencies in DetailPanel."
source="https://ui.nuxt.com/docs/components/card"
:code="snippets[0]!">
      <div class="grid gap-3 2xl:grid-cols-2">
        <UCard v-for="course in courses.slice(0, 2)" :key="course.id">
          <template #header><div class="flex flex-wrap items-center justify-between gap-2"><NuxtLink :to="'/courses/' + course.id" class="font-semibold text-highlighted">{{ course.name }}</NuxtLink><InlineStatus :label="course.status" :color="statusColor(course.status)" /></div></template>
          <dl class="grid grid-cols-[5rem_1fr] gap-2"><dt class="text-xs text-muted">Credits</dt><dd>{{ course.credits }}</dd><dt class="text-xs text-muted">Enrolment</dt><dd>{{ course.studentIds.length }} students</dd></dl>
          <template #footer><div class="flex items-center justify-between"><span class="text-xs text-muted">{{ course.studentIds.length ? 'Enrollment open' : 'No students yet' }}</span><UButton
icon="i-lucide-arrow-up-right"
:aria-label="'Open ' + course.name"
:to="'/courses/' + course.id"
variant="ghost"
color="neutral" /></div></template>
        </UCard>
      </div>
    </Example>
    <Example
title="Metric · total / context / distribution"
rule="Show one useful number, one label, and optional context. An icon may name the metric's subject — for every card in a row, or none."
rationale="The distribution explains the total. A metric needs neither a decorative icon nor a fabricated trend."
contract="StatCard label, value, delta?, progress? (0–100); default slot for supporting rows. Dependencies: UCard, UProgress. No events."
source="https://ui.nuxt.com/docs/components/progress"
:code="snippets[1]!">
      <div class="grid gap-3 sm:grid-cols-2"><StatCard
icon="i-lucide-graduation-cap"
label="Active courses"
:value="courses.filter(c => c.status === 'Active').length"
:delta="'of ' + courses.length"
:progress="courses.length ? courses.filter(c => c.status === 'Active').length / courses.length * 100 : 0" /><StatCard icon="i-lucide-user-x" label="Without students" :value="courses.filter(c => !c.studentIds.length).length"><p class="text-xs text-muted">Across the current catalog</p></StatCard></div>
    </Example>
    <Example
title="Capacity · occupied / claimed / available"
rule="Show how one total divides, using segments that add up to it."
rationale="A capacity question is answered by the split, not by a second number in prose. Native UProgressGroup owns the segmented bar; the card only decides where it sits and which shares are worth naming."
contract="StatCard segments (ProgressGroupItem[]) and max; mutually exclusive with progress. Dependencies: UCard, UProgressGroup. Segment values come from the host's own records."
source="https://ui.nuxt.com/docs/components/progress-group"
:code="snippets[12]!">
      <div class="max-w-sm"><StatCard
label="Section seats"
icon="i-lucide-armchair"
:value="capacity.enrolled + ' of ' + capacity.total"
:delta="capacity.available + ' available'"
:max="capacity.total"
:segments="[
  { label: 'Enrolled', value: capacity.enrolled, color: 'primary' },
  { label: 'Pending requests', value: capacity.pending, color: 'warning' },
  { label: 'Available', value: capacity.available, color: 'neutral' },
]" /></div>
    </Example>
    <Example
title="Summary list · short list / drill-in"
rule="Show three to five records and one destination for the full collection."
rationale="A short aligned list answers a useful question without embedding another full table."
contract="UCard header and footer + ListItem title/to, actions slot. Native link navigation. Dependencies: UCard, ListItem, UButton."
:code="snippets[2]!">
      <UCard><template #header><h3 class="text-sm font-semibold">Largest enrollments</h3></template><ListItem
v-for="course in [...courses].sort((a,b) => b.studentIds.length-a.studentIds.length).slice(0, 3)"
:key="course.id"
:title="course.name"
:to="'/courses/' + course.id"><template #actions><span class="text-xs tabular-nums text-muted">{{ course.studentIds.length }} students</span></template></ListItem><template #footer><UButton
label="All courses"
to="/courses"
variant="link"
color="neutral"
trailing-icon="i-lucide-chevron-right" /></template></UCard>
    </Example>
    <Example
title="Compact total · label / right-aligned count"
rule="One line per total: a label and a right-aligned figure, nothing else."
rationale="Counts compare vertically when their digits line up, so a set of totals needs neither a card each nor a metric's emphasis. Reach for this before a row of metric cards; a metric card is for a number the page is actually about."
contract="Ordinary markup in a single UCard: tabular-nums on the figure, text-muted on the label. No wrapper — there is no repeated decision to centralize."
:code="snippets[11]!">
      <UCard class="max-w-sm"><template #header><h3 class="text-sm font-semibold">Courses by department</h3></template><div
v-for="department in departments"
:key="department.label"
class="flex items-baseline justify-between gap-4 py-1"><span class="text-muted">{{ department.label }}</span><span class="font-medium tabular-nums text-highlighted">{{ department.count }}</span></div></UCard>
    </Example>
    <Example
title="Prompt · opportunity / next action"
rule="Use a dashed boundary and one secondary action; avoid a miniature tutorial."
rationale="A creation opportunity should look distinct from an existing record. A blocked-work summary should name the consequence."
contract="UCard with ui root border-dashed/ring-0, body slot. UButton outline. Native route links; no custom interaction engine."
source="https://ui.nuxt.com/docs/components/card"
:code="snippets[3]!">
      <div class="space-y-3"><UCard :ui="{ root: 'border border-dashed border-default ring-0', body: 'flex min-h-32 flex-col items-center justify-center gap-3 p-4' }"><p class="text-muted">Make room for another course.</p><UButton
label="New course"
to="/courses?new=1"
icon="i-lucide-plus"
color="neutral"
variant="outline" /></UCard><UCard><h3 class="text-sm font-semibold">Two requests need a decision</h3><p class="mt-1 text-xs text-muted">Review prerequisites before enrolling these students.</p><UButton
label="Review requests"
to="/gallery/recipes#requests"
variant="outline"
color="neutral"
class="mt-3" /></UCard></div>
    </Example>
    <Example
title="Detail · primary records / supporting facts"
rule="Give related records the main column; keep facts compact in a supporting panel."
rationale="People can inspect relationships and context together instead of navigating away from an oversized metric."
contract="Responsive grid + DetailPanel facts[] and named value slots. Dependencies: UCard and ordinary dl/dt/dd; links remain native."
:code="snippets[4]!">
      <DetailPanel title="Course details" :facts="[{ label: 'Credits', value: 4 }, { label: 'Students', value: 34 }, { label: 'Status', value: 'Active' }]"><template #Status><InlineStatus label="Active" color="success" /></template></DetailPanel><UButton
label="Open detail example"
to="/courses/c1"
color="neutral"
variant="link"
class="mt-2" />
    </Example>
    <Example
title="Activity · event / actor / time"
rule="Emphasize the event and keep actor and timestamp secondary."
rationale="Repeated aligned rows communicate a sequence without nested cards."
contract="ListItem leading/metadata slots with UIcon; ordered event fixtures belong to the host."
:code="snippets[5]!">
      <ListItem title="Course details updated"><template #leading><UIcon name="i-lucide-pencil" class="mt-1 size-4 text-muted" /></template><template #metadata>Alex Morgan · Today, 9:30 AM</template></ListItem><ListItem title="Three students enrolled"><template #leading><UIcon name="i-lucide-users" class="mt-1 size-4 text-muted" /></template><template #metadata>Jordan Lee · Yesterday</template></ListItem>
    </Example>
    <Example
title="Person · identity / context / status / actions"
rule="Use native UUser for a person row; add status and actions beside it, not inside it."
rationale="Avatar, name, and one supporting line is exactly what UUser composes, so wrapping it would change no default and add no behavior. The row's own decisions — which status the person carries and which actions they permit — stay in the host."
contract="UUser name, description, avatar, size, orientation and optional to. Dependencies: UUser, InlineStatus, UButton. Status colors come from the shared domain map."
source="https://ui.nuxt.com/docs/components/user"
:code="snippets[10]!">
      <UCard><div
v-for="person in people"
:key="person.id"
class="flex flex-wrap items-center justify-between gap-3 border-b border-default py-2 first:pt-0 last:border-0 last:pb-0"><UUser
:name="person.name"
:description="person.email"
:avatar="{ alt: person.name }"
size="sm" /><div class="flex items-center gap-2"><InlineStatus
:label="person.enrolled ? person.enrolled + ' courses' : 'No courses'"
:color="person.enrolled ? 'success' : 'warning'" /><UTooltip text="Open student"><UButton
icon="i-lucide-arrow-up-right"
:aria-label="'Open ' + person.name"
to="/courses/c1/students"
color="neutral"
variant="ghost" /></UTooltip></div></div></UCard>
    </Example>
    <div id="requests" class="scroll-mt-4">
    <Example
title="Decision list · person / eligibility / paired actions"
rule="Expose approve and decline only when making decisions is the central task."
rationale="Eligibility belongs beside the person. Approval is unavailable when prerequisites are missing; irreversible decline confirms locally."
contract="ListItem leading/metadata/actions, UAvatar, InlineStatus, UButton and ConfirmButton. Preview removes requests in memory; reset restores fixtures."
:code="snippets[6]!">
      <ListItem v-for="request in requests" :key="request.id" :title="request.name"><template #leading><UAvatar :alt="request.name" size="sm" /></template><template #metadata>{{ request.course }}<InlineStatus :label="request.eligible ? 'Eligible' : 'Missing prerequisite'" :color="request.eligible ? 'success' : 'warning'" /></template><template #actions><UTooltip :text="request.eligible ? 'Approve' : 'Prerequisite required'"><UButton
icon="i-lucide-check"
:aria-label="'Approve ' + request.name"
color="neutral"
variant="ghost"
:disabled="!request.eligible"
@click="decide(request.id, true)" /></UTooltip><ConfirmButton
:focus-fallback="focusDemoHeading"
:title="'Decline ' + request.name + '?'"
description="This request will be removed."
icon="i-lucide-x"
confirm-label="Decline"
:action="() => decide(request.id, false)" /></template></ListItem>
      <UEmpty v-if="!requests.length" icon="i-lucide-check-check" title="All requests reviewed" />
    </Example>
    </div>
    <Example
title="Grouped list · heading / count / child actions"
rule="Use native accordion behavior for expandable groups, not a second list engine."
rationale="Grouping makes the reason for a queue visible and keeps child records attached to that context."
contract="UAccordion items label/value, trailing and body slots. Dependencies: UAccordion, ListItem, UBadge. Native keyboard arrows and expansion."
source="https://ui.nuxt.com/docs/components/accordion"
:code="snippets[7]!">
      <UAccordion :items="groups"><template #trailing="{ item }"><UBadge color="neutral">{{ item.requests.length }}</UBadge></template><template #body="{ item }"><div class="border-l border-default pl-4"><ListItem v-for="request in item.requests" :key="request.id" :title="request.name"><template #metadata>{{ request.course }}</template></ListItem><p v-if="!item.requests.length" class="text-xs text-muted">No requests</p></div></template></UAccordion>
    </Example>
    <Example
title="Selectable / expandable / mobile row"
rule="Preserve identity and state; add controls only when the record needs them."
rationale="One composition supports standalone lists and the table's shared mobile row model."
contract="ListItem selected/expanded models, selectable/expandable props, leading/metadata/actions/expanded slots. No demo dependencies."
:code="snippets[8]!">
      <ListItem
v-model:selected="selected"
v-model:expanded="expanded"
title="Biology 101"
to="/courses/c1"
selectable
expandable
variant="card"><template #metadata><span>3 credits</span><span>12 students</span><InlineStatus label="Active" color="success" /></template><template #expanded><ListItem title="Alex Morgan"><template #leading><UAvatar alt="Alex Morgan" size="xs" /></template></ListItem></template></ListItem>
    </Example>
    <Example
title="Planning summary · time / people / next action"
rule="Keep schedule and participants visible without competing with identity."
rationale="The same hierarchy works for game sessions, meetings, and appointments."
contract="UCard header/footer + UAvatarGroup, InlineStatus, UButton. Native route navigation."
:code="snippets[9]!">
      <UCard><template #header><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">The sunken observatory</h3><InlineStatus label="Scheduled" color="info" /></div></template><p class="text-xs text-muted">Sep 12 · 6:30 PM</p><p class="mt-2">Follow the star chart beneath the harbor.</p><template #footer><div class="flex items-center justify-between"><UAvatarGroup><UAvatar alt="Alex Morgan" size="xs" /><UAvatar alt="Sam Rivera" size="xs" /></UAvatarGroup><UButton
label="Open session"
to="/planning/g1"
color="neutral"
variant="outline" /></div></template></UCard>
    </Example>
  </div>
</template>
