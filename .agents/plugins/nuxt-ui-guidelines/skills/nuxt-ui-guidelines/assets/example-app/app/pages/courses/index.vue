<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Course } from "../../composables/useDemo";
import DataTable from "../../components/kit/DataTable.vue";
import PageHeader from "../../components/kit/PageHeader.vue";
import RecordActions from "../../components/kit/ActionMenu.vue";
import CourseForm from "../../components/demo/CourseForm.vue";
import StatCard from '../../components/kit/StatCard.vue';
import InlineStatus from '../../components/kit/InlineStatus.vue';
useHead({ title: "Courses" });
const { courses, students } = useDemo();
const toast = useToast();
const archiveWithUndo = useArchive();
const { open, editing, duplicate, form } = useQueryEditor(courses);
function archive(items: Course[]) {
  archiveWithUndo(items, courses, items.length === 1 ? items[0]!.name : `${items.length} courses`);
}
function remove(items: Course[]) {
  const ids = new Set(items.map((c) => c.id));
  courses.value = courses.value.filter((c) => !ids.has(c.id));
  toast.add({
    title:
      items.length === 1 ? "Course deleted" : items.length + " courses deleted",
    color: "success",
  });
}
const columns: TableColumn<Course>[] = [
  { accessorKey: "name", header: "Course", enableHiding: false },
  { accessorKey: "credits", header: "Credits", filterFn: "includesString", meta: { class: { td: 'text-right tabular-nums' } } },
  {
    id: "students",
    accessorFn: (row) => row.studentIds.length,
    header: "Students",
    filterFn: "includesString",
    meta: { class: { td: 'text-right tabular-nums' } },
  },
  { accessorKey: "status", header: "Status", meta: { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } } },
];
</script>
<template>
  <UDashboardPanel id="courses">
    <template #header
      ><PageHeader
title="Courses"
:count="courses.length + ' courses'"
:breadcrumbs="[{ label: 'Courses' }]"
        ><template #actions
          ><UButton
            label="New course"
            icon="i-lucide-plus"
            @click="form()" /></template></PageHeader
    ></template>
    <template #body>
      <div class="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
icon="i-lucide-graduation-cap"
label="Active courses"
:value="courses.filter(c => c.status === 'Active').length" />
        <StatCard
icon="i-lucide-users"
label="Enrollments"
:value="courses.reduce((total, c) => total + c.studentIds.length, 0)" />
        <StatCard
icon="i-lucide-user-x"
label="Without students"
:value="courses.filter(c => !c.studentIds.length).length"
:tone="courses.some(c => !c.studentIds.length) ? 'warning' : 'neutral'" />
      </div>
      <DataTable
        delete-description="Selected records will be removed from this demo. Refreshing restores the example data."
        :data="courses"
        :columns="columns"
        :title="(c) => c.name"
        :to="(c) => '/courses/' + c.id"
        :description="(c) => c.description"
        :archive="archive"
        :remove="remove"
        :focus-fallback="focusDemoHeading"
        empty-title="No courses yet"
        empty-description="Create the first course to start building the catalog."
        :empty-actions="[{ label: 'New course', icon: 'i-lucide-plus', onClick: () => form() }]"
        filename="courses.csv"
      >
        <template #name-cell="{ row }"
          ><NuxtLink
            :to="'/courses/' + row.original.id"
            class="font-medium text-highlighted hover:text-primary"
            >{{ row.original.name }}</NuxtLink
          ></template
        >
        <template #status-cell="{ row }"
          ><InlineStatus
            :color="statusColor(row.original.status)"
            :label="row.original.status"
          /></template
        >
        <template #actions-cell="{ row }"
          ><RecordActions
delete-description="This record will be removed from this demo. Refreshing restores the example data."
:focus-fallback="focusDemoHeading"
            :name="row.original.name"
            :to="'/courses/' + row.original.id"
            :edit="() => form(row.original)"
            :duplicate="() => form(row.original, true)"
            :archive="() => archive([row.original])"
            :remove="() => remove([row.original])"
            :archived="row.original.status === 'Archived'"
        /></template>
        <template #expanded="{ row }"
          ><div class="p-3">
            <p class="max-w-2xl text-sm text-muted">
              {{ row.original.description }}
            </p>
            <p class="mt-2 text-xs">
              {{
                row.original.studentIds
                  .map((id: string) => students.find((s) => s.id === id)?.name)
                  .join(" · ") || "No students enrolled"
              }}
            </p>
          </div></template
        >
        <template #card-metadata="{ row, visibleColumns }"
          ><span v-if="visibleColumns.includes('credits')">{{ row.original.credits }} credits</span
          ><span v-if="visibleColumns.includes('students')">{{ row.original.studentIds.length }} students</span
          ><InlineStatus
            v-if="visibleColumns.includes('status')"
            :color="statusColor(row.original.status)"
            :label="row.original.status"
          /></template
        >
      </DataTable>
      <CourseForm
        v-model:open="open"
        :course="editing"
        :duplicate="duplicate"
      />
    </template>
  </UDashboardPanel>
</template>
