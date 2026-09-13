<script setup lang="ts">
import { z } from "zod";
import EntityForm from "../kit/EntityForm.vue";
import type { GameSession } from "../../composables/useDemo";
const props = defineProps<{
  open: boolean;
  session?: GameSession;
  duplicate?: boolean;
}>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const { students, sessions } = useDemo();
const toast = useToast();
const state = reactive({
  title: "",
  description: "",
  scheduledAt: "",
  participantIds: [] as string[],
});
watch(
  () => props.open,
  (value) => {
    if (value)
      Object.assign(
        state,
        props.session
          ? {
              title: props.session.title + (props.duplicate ? " (copy)" : ""),
              description: props.session.description,
              scheduledAt: props.session.scheduledAt,
              participantIds: props.duplicate ? [] : [...props.session.participantIds],
            }
          : {
              title: "",
              description: "",
              scheduledAt: "2026-09-20T18:00",
              participantIds: [],
            },
      );
  },
  { immediate: true },
);
const schema = z.object({
  title: z.string().trim().min(1, "Enter a session title"),
  description: z.string().trim().min(1, "Enter a description"),
  scheduledAt: z.string().min(1, "Choose a time"),
  participantIds: z.array(z.string()),
});
function save() {
  const data = schema.parse(state);
  if (props.session && !props.duplicate) {
    const index = sessions.value.findIndex((s) => s.id === props.session?.id);
    if (index < 0) throw new Error("This session is no longer available.");
    sessions.value[index] = { ...sessions.value[index]!, ...data };
  } else
    sessions.value.unshift({
      id: crypto.randomUUID(),
      ...data,
      status: "Planned",
    });
  toast.add({ title: `Saved ${data.title}`, color: "success" });
}
</script>
<template>
  <EntityForm
:focus-fallback="focusDemoHeading"
    :open="open"
    :title="session && !duplicate ? 'Edit session' : 'New session'"
    :mode="session && !duplicate ? 'edit' : 'create'"
    :state="state"
    :schema="schema"
    :save="save"
    :valid="schema.safeParse(state).success"
    :submit-label="session && !duplicate ? 'Save changes' : 'Create session'"
    @update:open="emit('update:open', $event)"
  >
    <UFormField
label="Title"
name="title"
required
      ><UInput
v-model="state.title"
autofocus
class="w-full"
    /></UFormField>
    <UFormField
label="Description"
name="description"
required
      ><UTextarea
v-model="state.description"
class="w-full"
    /></UFormField>
    <UFormField
label="Scheduled time"
name="scheduledAt"
required
      ><UInput
v-model="state.scheduledAt"
type="datetime-local"
class="w-full"
    /></UFormField>
    <UFormField
v-if="session && !duplicate"
label="Participants"
name="participantIds"
      ><USelectMenu
        v-model="state.participantIds"
        :items="students.map((s) => ({ label: s.name, value: s.id }))"
        value-key="value"
        multiple
        class="w-full"
        placeholder="Select participants"
    /></UFormField>
    <p v-if="!session || duplicate" class="text-xs text-muted">Participants can be added after saving.</p>
  </EntityForm>
</template>
