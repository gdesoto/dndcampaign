<script setup lang="ts">
import { z } from "zod";
import Example from "../../components/gallery/Example.vue";
import ConfirmButton from "../../components/kit/ConfirmButton.vue";
import EntityForm from "../../components/kit/EntityForm.vue";
import DataTable from "../../components/kit/DataTable.vue";
const toast = useToast();
const open = ref(false);
const fail = ref(true);
const state = reactive({ name: "" });
const schema = z.object({ name: z.string().min(1, "Enter a name") });
const rows = [{ id: "1", name: "Biology 101" }];
const columns = [{ accessorKey: "name", header: "Name" }];
async function delayed() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  toast.add({ title: "Example completed", color: "success" });
}
async function failure() {
  await new Promise((resolve) => setTimeout(resolve, 600));
  throw new Error("Unable to complete. Try again.");
}
async function save() {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (fail.value) throw new Error("Unable to save. Your input is preserved.");
  toast.add({ title: "Example saved", color: "success" });
}
useHead({ title: "Interaction states" });
</script>
<template>
  <div class="space-y-6">
    <h2 class="text-base font-semibold text-highlighted">Make every state usable.</h2>
    <Example
      title="Loading and empty"
      rule="Keep structure stable while loading; offer the next action when empty."
      rationale="A placeholder is temporary. An empty collection is a valid state."
      contract="DataTable loading=true; data=[] for an empty collection. Loading uses UTable/USkeleton. An empty collection resolves to UEmpty with the host's emptyActions; a filtered-out one offers Clear filters instead."
      :code="'<DataTable :data=&quot;records&quot; :columns=&quot;columns&quot; :title=&quot;r => r.name&quot; empty-title=&quot;No records yet&quot; :empty-actions=&quot;createAction&quot; />'"
      ><div class="space-y-5">
        <DataTable
          :data="rows"
          :columns="columns"
          :title="(r) => r.name"
          loading
        /><DataTable
          :data="[] as { id: string; name: string }[]"
          :columns="columns"
          :title="(r) => r.name"
          empty-title="No records yet"
          empty-description="Create the first record to start this collection."
          :empty-actions="[{ label: 'New example', icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => (open = true) }]"
        /></div
    ></Example>
    <Example
      title="No search results"
      rule="Let people recover by clearing their filters."
      rationale="No matches does not imply that the collection is empty."
      contract="Use the search control below with a non-matching value; Clear filters restores the row model."
      :code="'<!-- DataTable distinguishes empty data from filtered-out data. -->\n<DataTable :data=&quot;records&quot; :columns=&quot;columns&quot; :title=&quot;r => r.name&quot; />'"
      ><DataTable
:data="rows"
:columns="columns"
:title="(r) => r.name"
    /></Example>
    <Example
      title="Validation and submission failure"
      rule="Keep input intact and show errors near the field or submission."
      rationale="Blank names fail validation; valid input reaches the simulated operation. Toggle failure off to verify recovery."
      contract="EntityForm schema validation precedes save; rejected save keeps the modal open. Pending prevents double submission."
      :code="'async function save() {\n  await service.save(state) // rejection keeps input and displays error\n}'"
      ><div class="flex flex-wrap items-center gap-4">
        <UButton
          label="Open form"
          color="neutral"
          variant="outline"
          @click="open = true"
        /><UCheckbox v-model="fail" label="Simulate save failure" />
      </div>
      <EntityForm
v-model:open="open"
        :focus-fallback="focusDemoHeading"
        title="New example"
        mode="create"
        :state="state"
        :schema="schema"
        :save="save"
        ><UFormField
label="Name"
name="name"
required
          ><UInput
            v-model="state.name"
            autofocus
            class="w-full" /></UFormField></EntityForm
    ></Example>
    <Example
      title="Pending, failed, and disabled confirmation"
      rule="Wait for success before closing; allow retry after failure."
      rationale="A promise is the boundary between intent and completion."
      contract="ConfirmButton awaits action, locks confirmation while pending, and presents a rejected error. Disabled prevents opening."
      :code="'<ConfirmButton :action=&quot;async () => { await service.remove(id) }&quot; title=&quot;Delete record?&quot; description=&quot;This removes the record.&quot; />'"
      ><div class="flex gap-3">
        <ConfirmButton
:focus-fallback="focusDemoHeading"
          title="Delete slow example?"
          description="Completes after a short delay."
          :action="delayed"
        /><ConfirmButton
:focus-fallback="focusDemoHeading"
          title="Delete failing example?"
          description="This example demonstrates a recoverable failure."
          :action="failure"
        /><ConfirmButton
:focus-fallback="focusDemoHeading"
          title="Delete unavailable example"
          description="Unavailable"
          :action="delayed"
          disabled
        /></div
    ></Example>
  </div>
</template>
