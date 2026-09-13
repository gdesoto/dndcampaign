<script setup lang="ts">
import { z } from "zod";
import PageHeader from "../components/kit/PageHeader.vue";
// Settings is not a record editor — nothing here is created, duplicated or
// deleted — so it owns a plain UForm rather than EntityForm, and Cancel restores
// the last saved values without a prompt. The test is what Cancel destroys:
// here it destroys nothing the server does not already hold.
//
// It is also where section 6's rule about explanatory prose is worked through,
// one section per answer. Profile asks nothing its labels do not already
// answer. Notifications explains the group once instead of four times. Data is
// the one section that genuinely owes an explanation, and it pays it three
// different ways rather than printing all three on the page.
const toast = useToast();
const saved = {
  name: "Alex Morgan",
  email: "alex.morgan@example.edu",
  timeZone: "london",
  weekStart: "monday",
  published: true,
  requests: true,
  overCapacity: false,
  weekly: true,
  retention: "90",
  exportFormat: "csv",
};
const state = reactive({ ...saved });
const schema = z.object({
  name: z.string().trim().min(1, "Enter a display name"),
  email: z.string().trim().email("Enter a valid email address"),
});
// Options that name themselves need no sentence underneath them.
const zones = [
  { label: "London — UTC+00:00", value: "london" },
  { label: "New York — UTC−05:00", value: "newyork" },
  { label: "Tokyo — UTC+09:00", value: "tokyo" },
];
const weekStarts = [
  { label: "Monday", value: "monday" },
  { label: "Sunday", value: "sunday" },
];
const retentions = [
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "One year", value: "365" },
  { label: "Keep indefinitely", value: "never" },
];
const formats = [
  { label: "CSV — opens in a spreadsheet", value: "csv" },
  { label: "JSON — keeps related records", value: "json" },
];
// Background rather than instruction: worth reading once, not on every visit.
// The same string is announced through the field's description and shown on
// demand in the popover, so deferring it costs a screen reader nothing.
const exportBackground
  = "CSV flattens each record to one row and drops its relationships, which suits a spreadsheet. JSON keeps the nested structure, which suits another system reading the file.";
const notifications = [
  { key: "published", label: "Course published" },
  { key: "requests", label: "Enrollment request received" },
  { key: "overCapacity", label: "Section over capacity" },
  { key: "weekly", label: "Weekly summary" },
] as const;
function save() {
  Object.assign(saved, state);
  toast.add({ title: "Settings saved", color: "success" });
}
function cancel() {
  Object.assign(state, saved);
}
useHead({ title: "Settings" });
</script>
<template>
  <UDashboardPanel id="settings">
    <template #header><PageHeader title="Settings" /></template>
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="max-w-3xl space-y-4"
        @submit="save"
      >
        <!-- Profile: every field is answered by its own label, so the section
             carries no prose at all. Two columns are safe here precisely
             because no field has a description to knock the rows out of line. -->
        <UCard>
          <template #header><h2 class="text-sm font-semibold text-highlighted">Profile</h2></template>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Display name" name="name">
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField label="Email address" name="email">
              <UInput
                v-model="state.email"
                type="email"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Time zone" name="timeZone">
              <USelect
                v-model="state.timeZone"
                :items="zones"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Week starts on" name="weekStart">
              <USelect
                v-model="state.weekStart"
                :items="weekStarts"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- Notifications: one sentence for the group replaces four nearly
             identical ones. What the switches share is the whole explanation;
             what differs between them is already in their labels. -->
        <UCard>
          <template #header>
            <h2 class="text-sm font-semibold text-highlighted">Notifications</h2>
            <p class="mt-1 text-xs text-muted">
              Sent by email to {{ saved.email }}. None of them change what appears in the application.
            </p>
          </template>
          <div class="grid gap-3 sm:grid-cols-2">
            <USwitch
              v-for="item in notifications"
              :key="item.key"
              v-model="state[item.key]"
              :label="item.label"
            />
          </div>
        </UCard>

        <!-- Data: the section that genuinely owes an explanation, and the one
             place the three answers differ from each other. Retention keeps a
             visible line because the consequence has to be known before the
             value changes; export defers its background to a focusable trigger;
             the rest lives behind a link. Stacked rather than in a grid,
             because only one of the two fields carries a visible line and a
             two-column row would put the controls on different baselines. -->
        <UCard>
          <template #header><h2 class="text-sm font-semibold text-highlighted">Data</h2></template>
          <div class="space-y-3">
            <UFormField
              label="Delete completed records after"
              name="retention"
              help="Deleted records cannot be recovered."
            >
              <USelect
                v-model="state.retention"
                :items="retentions"
                class="w-full sm:w-72"
              />
            </UFormField>
            <UFormField
              label="Export format"
              name="exportFormat"
              :description="exportBackground"
              :ui="{ description: 'sr-only', labelWrapper: 'justify-start' }"
            >
              <template #hint>
                <UPopover>
                  <UButton
                    type="button"
                    icon="i-lucide-info"
                    aria-label="About export formats"
                    color="neutral"
                    variant="ghost"
                  />
                  <template #content>
                    <p class="max-w-xs p-3 text-sm text-muted">{{ exportBackground }}</p>
                  </template>
                </UPopover>
              </template>
              <USelect
                v-model="state.exportFormat"
                :items="formats"
                class="w-full sm:w-72"
              />
            </UFormField>
          </div>
          <template #footer>
            <UButton
              label="How retention and export work"
              icon="i-lucide-book-open"
              to="/guide"
              color="neutral"
              variant="link"
              class="px-0"
            />
          </template>
        </UCard>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="cancel"
          /><UButton label="Save changes" type="submit" />
        </div>
      </UForm>
    </template>
  </UDashboardPanel>
</template>
