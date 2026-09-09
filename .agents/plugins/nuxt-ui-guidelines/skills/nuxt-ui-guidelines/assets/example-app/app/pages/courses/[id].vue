<script setup lang="ts">
import PageHeader from "../../components/kit/PageHeader.vue";
import CourseForm from "../../components/demo/CourseForm.vue";
import RecordActions from "../../components/kit/ActionMenu.vue";
const { courses } = useDemo();
const route = useRoute();
const course = computed(() =>
  courses.value.find((c) => c.id === route.params.id),
);
const toast = useToast();
const archiveWithUndo = useArchive();
const { open, duplicate, form: openEditor } = useQueryEditor(courses);
function form(copy = false) {
  if (course.value) openEditor(course.value, copy);
}
function archive() {
  if (course.value) archiveWithUndo([course.value], courses, course.value.name);
}
async function remove() {
  courses.value = courses.value.filter((c) => c.id !== route.params.id);
  toast.add({ title: "Course deleted", color: "success" });
  await navigateTo("/courses");
}
useHead({ title: () => course.value?.name || "Course not found" });
</script>
<template>
  <UDashboardPanel id="course-detail">
    <template #header>
      <PageHeader
        :title="course?.name || 'Course not found'"
        :breadcrumbs="[
          { label: 'Courses', to: '/courses' },
          { label: course?.name || 'Not found' },
        ]"
      >
        <template
v-if="course"
#actions
          ><RecordActions
delete-description="This record will be removed from this demo. Refreshing restores the example data."
:focus-fallback="focusDemoHeading"
            :name="course.name"
            :edit="() => form()"
            :duplicate="() => form(true)"
            :archive="archive"
            :remove="remove"
            :archived="course.status === 'Archived'"
        /></template>
      </PageHeader>
      <UDashboardToolbar v-if="course"
        ><UNavigationMenu
          highlight
          aria-label="Course sections"
          :items="[
            { label: 'Overview', to: '/courses/' + course.id, exact: true },
            {
              label: 'Students',
              to: '/courses/' + course.id + '/students',
              badge: course.studentIds.length,
            },
            { label: 'Assessments', to: '/courses/' + course.id + '/assessments' },
          ]"
      /></UDashboardToolbar>
    </template>
    <template #body>
      <template v-if="course"
        ><NuxtPage /><CourseForm
          v-model:open="open"
          :course="course"
          :duplicate="duplicate"
      /></template>
      <UEmpty
        v-else
        icon="i-lucide-circle-alert"
        title="This course is unavailable."
        description="It may have been deleted, or the link may be out of date."
        :actions="[{ label: 'Open courses', to: '/courses', color: 'neutral', variant: 'outline' }]"
      />
    </template>
  </UDashboardPanel>
</template>
