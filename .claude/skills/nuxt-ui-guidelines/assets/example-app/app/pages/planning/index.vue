<script setup lang="ts">
import PageHeader from "../../components/kit/PageHeader.vue";
import DataTable from "../../components/kit/DataTable.vue";
import SessionForm from "../../components/demo/SessionForm.vue";
import RecordActions from "../../components/kit/ActionMenu.vue";
import InlineStatus from "../../components/kit/InlineStatus.vue";
import type { GameSession } from "../../composables/useDemo";
import type { TableColumn } from "@nuxt/ui";
const { sessions, students } = useDemo();
const toast = useToast();
const archiveWithUndo = useArchive();
const { open, editing, duplicate, form } = useQueryEditor(sessions);
// Cards and table are two presentations of one row model, so both keep the
// same search, sorting, selection, pagination and export.
const view = ref<"cards" | "table">("cards");
function archive(items: GameSession[]) {
  archiveWithUndo(items, sessions, items.length === 1 ? items[0]!.title : `${items.length} sessions`);
}
function remove(items: GameSession[]) {
  const ids = new Set(items.map((s) => s.id));
  sessions.value = sessions.value.filter((s) => !ids.has(s.id));
  toast.add({
    title: items.length === 1 ? "Session deleted" : items.length + " sessions deleted",
    color: "success",
  });
}
function time(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
const columns: TableColumn<GameSession>[] = [
  { accessorKey: "title", header: "Session", enableHiding: false },
  { accessorKey: "scheduledAt", header: "Scheduled" },
  {
    id: "participants",
    header: "Participants",
    accessorFn: (s) => s.participantIds.length,
    filterFn: "includesString",
    meta: { class: { td: 'text-right tabular-nums' } },
  },
  { accessorKey: "status", header: "Status", meta: { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } } },
];
useHead({ title: "Game planning" });
</script>
<template>
  <UDashboardPanel id="planning">
    <template #header
      ><PageHeader
title="Game planning"
:count="sessions.length + ' sessions'"
:breadcrumbs="[{ label: 'Game planning' }]"
        ><template #actions
          ><UButton
            label="New session"
            icon="i-lucide-plus"
            @click="form()" /></template></PageHeader
    ></template>
    <template #body>
      <URadioGroup
        v-model="view"
        variant="table"
        orientation="horizontal"
        indicator="hidden"
        size="sm"
        aria-label="Session view"
        :items="[
          { label: 'Cards', value: 'cards' },
          { label: 'Table', value: 'table' },
        ]"
      />
      <DataTable
        delete-description="Selected records will be removed from this demo. Refreshing restores the example data."
        :data="sessions"
        :columns="columns"
        :view="view"
        :title="(s) => s.title"
        :to="(s) => '/planning/' + s.id"
        :description="(s) => s.description"
        :archive="archive"
        :remove="remove"
        :focus-fallback="focusDemoHeading"
        empty-title="No sessions yet"
        empty-description="Plan a session to invite players and share the schedule."
        :empty-actions="[{ label: 'New session', icon: 'i-lucide-plus', onClick: () => form() }]"
        filename="sessions.csv"
      >
        <template #title-cell="{ row }"
          ><NuxtLink
            :to="'/planning/' + row.original.id"
            class="font-medium text-highlighted hover:text-primary"
            >{{ row.original.title }}</NuxtLink
          ></template
        >
        <template #scheduledAt-cell="{ row }"
          ><span class="font-mono text-xs">{{ time(row.original.scheduledAt) }}</span></template
        >
        <template #status-cell="{ row }"
          ><InlineStatus
            :color="statusColor(row.original.status)"
            :label="row.original.status"
        /></template>
        <template #actions-cell="{ row }"
          ><RecordActions
delete-description="This record will be removed from this demo. Refreshing restores the example data."
:focus-fallback="focusDemoHeading"
            :name="row.original.title"
            :to="'/planning/' + row.original.id"
            :edit="() => form(row.original)"
            :duplicate="() => form(row.original, true)"
            :archive="() => archive([row.original])"
            :remove="() => remove([row.original])"
            :archived="row.original.status === 'Archived'"
        /></template>
        <template #expanded="{ row }"
          ><p class="p-3">{{ row.original.description }}</p></template
        >
        <template #card-metadata="{ row, visibleColumns }"
          ><span
v-if="visibleColumns.includes('scheduledAt')"
class="flex items-center gap-1"
            ><UIcon name="i-lucide-calendar-days" /><span class="font-mono">{{ time(row.original.scheduledAt) }}</span></span
          ><UAvatarGroup
            v-if="visibleColumns.includes('participants')"
            size="3xs"
            ><UAvatar
              v-for="id in row.original.participantIds"
              :key="id"
              :alt="students.find((s) => s.id === id)?.name" /></UAvatarGroup
          ><span v-if="visibleColumns.includes('participants')" class="tabular-nums">{{ row.original.participantIds.length }} players</span
          ><InlineStatus
            v-if="visibleColumns.includes('status')"
            :color="statusColor(row.original.status)"
            :label="row.original.status"
          /></template
        >
      </DataTable>
      <SessionForm
        v-model:open="open"
        :session="editing"
        :duplicate="duplicate"
      />
    </template>
  </UDashboardPanel>
</template>
