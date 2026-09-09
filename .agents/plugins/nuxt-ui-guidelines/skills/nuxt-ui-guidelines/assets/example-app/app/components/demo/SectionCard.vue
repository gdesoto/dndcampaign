<script setup lang="ts">
import type { Section } from '../../utils/academicRules';
import InlineStatus from '../kit/InlineStatus.vue';
import RecordActions from '../kit/ActionMenu.vue';
const props = defineProps<{ section: Section }>();
defineEmits<{ edit: [section: Section] }>();
const { courseFor, enrollment, sectionIssue, publish } = useAcademics();
const course = computed(() => courseFor(props.section));
const issue = computed(() => sectionIssue(props.section));
const toast = useToast();
// A semantic left edge makes an exception scannable across a grid of cards
// without spending space or replacing the status word.
const edge = computed(() => issue.value ? (issue.value === 'Over capacity' ? 'border-l-2 border-error' : 'border-l-2 border-warning') : '');
function publishSection() { try { publish(props.section); } catch (e) { toast.add({ title: e instanceof Error ? e.message : 'Unable to publish', color: 'error', duration: 0 }); } }
</script>
<template>
  <UCard :id="section.id" :class="edge">
    <template #header><div class="flex flex-wrap items-center justify-between gap-2"><div class="min-w-0"><NuxtLink :to="'/courses/' + section.courseId" class="text-data font-semibold text-highlighted hover:text-primary">{{ course?.name }}</NuxtLink><p class="mt-0.5 text-xs text-muted">{{ section.name }}</p></div><InlineStatus :label="issue || (section.published ? 'Published' : 'Draft')" :color="statusColor(issue || (section.published ? 'Published' : 'Draft'))" /></div></template>
    <dl class="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-data"><dt class="text-xs text-muted">Instructor</dt><dd :class="!section.instructor ? 'text-warning' : 'text-highlighted'"><span v-if="section.instructor" class="flex items-center gap-1.5"><UAvatar :alt="section.instructor" size="3xs" />{{ section.instructor }}</span><template v-else>Unassigned</template></dd><dt class="text-xs text-muted">Room</dt><dd>{{ section.room || 'Unassigned' }}</dd><dt class="text-xs text-muted">Meets</dt><dd class="font-mono text-xs">{{ section.schedule }}</dd></dl>
    <UProgress
:model-value="Math.min(enrollment(section), section.capacity)"
:max="section.capacity"
:color="enrollment(section) > section.capacity ? 'error' : 'primary'"
:aria-label="section.name + ' seats filled'"
size="xs"
class="mt-3" />
    <template #footer><div class="flex items-center gap-2"><span class="mr-auto font-mono text-xs tabular-nums" :class="enrollment(section) > section.capacity ? 'text-error' : 'text-muted'">{{ enrollment(section) }} of {{ section.capacity }} seats</span><UButton
v-if="!section.published && !issue && course?.status === 'Active'"
label="Publish"
icon="i-lucide-send"
color="neutral"
variant="outline"
@click="publishSection" /><RecordActions
:name="(course?.name || 'Course') + ' ' + section.name"
:to="'/courses/' + section.courseId"
:edit="() => $emit('edit', section)" /></div></template>
  </UCard>
</template>
