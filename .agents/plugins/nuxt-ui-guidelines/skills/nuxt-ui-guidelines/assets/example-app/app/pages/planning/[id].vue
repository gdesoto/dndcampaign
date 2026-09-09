<script setup lang="ts">
import PageHeader from "../../components/kit/PageHeader.vue";
import ListItem from "../../components/kit/ListItem.vue";
import SessionForm from "../../components/demo/SessionForm.vue";
import DetailPanel from '../../components/kit/DetailPanel.vue';
import InlineStatus from '../../components/kit/InlineStatus.vue';
import RecordActions from '../../components/kit/ActionMenu.vue';
const { sessions, students } = useDemo();
const route = useRoute();
const toast = useToast();
const archiveWithUndo = useArchive();
const session = computed(() =>
  sessions.value.find((s) => s.id === route.params.id),
);
const players = computed(() => students.value.filter(s => session.value?.participantIds.includes(s.id)));
const { open, duplicate, form: openEditor } = useQueryEditor(sessions);
function form(copy = false) {
  if (session.value) openEditor(session.value, copy);
}
function archive() {
  if (session.value) archiveWithUndo([session.value], sessions, session.value.title);
}
async function remove() {
  sessions.value = sessions.value.filter((s) => s.id !== route.params.id);
  toast.add({ title: "Session deleted", color: "success" });
  await navigateTo("/planning");
}
function when(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
useHead({ title: () => session.value?.title || "Session not found" });
</script>
<template>
  <UDashboardPanel id="session-detail">
    <template #header
      ><PageHeader
        :title="session?.title || 'Session not found'"
        :breadcrumbs="[
          { label: 'Game planning', to: '/planning' },
          { label: session?.title || 'Not found' },
        ]"
        ><template
v-if="session"
#actions
          ><RecordActions
delete-description="This record will be removed from this demo. Refreshing restores the example data."
:focus-fallback="focusDemoHeading"
            :name="session.title"
            :edit="() => form()"
            :duplicate="() => form(true)"
            :archive="archive"
            :remove="remove"
            :archived="session.status === 'Archived'" /></template></PageHeader
    ></template>
    <template #body>
      <div v-if="session" class="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div class="space-y-3">
          <UCard
            ><template #header><h2 class="text-sm font-semibold">Players <span class="ml-1 text-xs font-normal text-muted">{{ players.length }}</span></h2></template
            ><ListItem
              v-for="student in players"
              :key="student.id"
              :title="student.name"
              ><template #leading
                ><UAvatar :alt="student.name" size="sm" /></template
              ><template #metadata>{{ student.email }}</template></ListItem
            >
            <UEmpty
              v-if="!players.length"
              icon="i-lucide-users"
              title="No players yet"
              description="Add players from the session editor."
              :actions="[{ label: 'Edit session', color: 'neutral', variant: 'outline', onClick: () => form() }]"
          /></UCard>
          <UCard
variant="soft"
            ><template #header><h2 class="text-sm font-semibold">The plan</h2></template
            ><p class="text-data leading-relaxed text-muted">{{ session.description }}</p></UCard
          >
        </div>
        <DetailPanel
          title="Session details"
          :facts="[
            { label: 'Scheduled', value: when(session.scheduledAt) },
            { label: 'Players', value: session.participantIds.length },
            { label: 'Status', value: session.status },
          ]"
          ><template #actions
            ><UTooltip text="Edit session details"
              ><UButton
                icon="i-lucide-pencil"
                :aria-label="'Edit ' + session.title"
                color="neutral"
                variant="ghost"
                @click="form()" /></UTooltip></template
          ><template #Status
            ><InlineStatus
:label="session.status"
:color="statusColor(session.status)"
          /></template>
        </DetailPanel>
        <SessionForm
v-model:open="open"
:session="session"
:duplicate="duplicate" />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-circle-alert"
        title="This session is unavailable."
        description="It may have been deleted, or the link may be out of date."
        :actions="[{ label: 'Open game planning', to: '/planning', color: 'neutral', variant: 'outline' }]"
      />
    </template>
  </UDashboardPanel>
</template>
