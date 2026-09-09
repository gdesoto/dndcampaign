<script setup lang="ts">
import { z } from "zod";
import Example from "../../components/gallery/Example.vue";
import ConfirmButton from "../../components/kit/ConfirmButton.vue";
import EntityForm from "../../components/kit/EntityForm.vue";
import ListItem from "../../components/kit/ListItem.vue";
import DataTable from "../../components/kit/DataTable.vue";
import PageHeader from "../../components/kit/PageHeader.vue";
import InlineStatus from '../../components/kit/InlineStatus.vue';
import ActionMenu from '../../components/kit/ActionMenu.vue';
const toast = useToast();
const open = ref(false);
const formMode = ref<'create' | 'edit'>('edit');
const previewRecords = ref([{ id: 'preview', status: 'Active' }]);
const archivePreview = useArchive();
function archiveExample() { archivePreview(previewRecords.value, previewRecords, 'example record'); }
const state = reactive({ name: "A shared form" });
const selected = ref(false);
const rowClickable = ref(false);
const expanded = ref(false);
const query = ref("");
const choice = ref("Active");
const number = ref(3);
const tab = ref("one");
const page = ref(1);
const schema = z.object({ name: z.string().min(1, "Enter a name") });
const colorMode = useColorMode();
const appearances = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' },
];
const appearanceMenu = computed(() => appearances.map(item => ({
  label: item.label,
  icon: item.icon,
  type: 'checkbox' as const,
  checked: colorMode.preference === item.value,
  onSelect: () => { colorMode.preference = item.value; },
})));
const samples = ref([
  { id: "1", name: "Biology 101", status: "Active" },
  { id: "2", name: "Writing workshop", status: "Archived" },
]);
function saved() {
  toast.add({ title: "Saved", color: "success" });
}
useHead({ title: "Components" });
</script>
<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-primary">The toolkit</p>
      <h2 class="mt-1 text-base font-semibold text-highlighted">
        Familiar pieces. Purposeful choices.
      </h2>
      <p class="mt-2 max-w-2xl text-sm text-muted">
        Live examples, supported variants, and the contracts to copy into your
        next application.
      </p>
    </div>
    <Example
title="InlineStatus · UBadge"
rule="Pair a short status word with a semantic dot; never rely on color alone."
rationale="A consistent status vocabulary makes exceptions recognizable without enlarging the badge."
contract="InlineStatus label, color (success/warning/error/info/neutral/primary). Dependency: native UBadge; no events or demo state. Pair it with a semantic leading border on the affected card when an exception must be scannable across a grid; the status word always stays."
source="https://ui.nuxt.com/docs/components/badge"
:code="'<InlineStatus label=&quot;Needs review&quot; color=&quot;warning&quot; />'">
      <div class="flex flex-wrap gap-2"><InlineStatus label="Active" color="success" /><InlineStatus label="Draft" /><InlineStatus label="Needs review" color="warning" /><InlineStatus label="Over capacity" color="error" /><InlineStatus label="Scheduled" color="info" /><InlineStatus label="Archived" /></div>
    </Example>
    <Example
title="ActionMenu · UDropdownMenu"
rule="Use one trailing menu in the fixed Open, Edit, Duplicate, Archive, Delete order."
rationale="Repeated shortcuts add visual competition. Archive callbacks implement Undo; irreversible deletion opens a confirmation popover."
contract="Props: name, to?, optional edit/duplicate/archive/remove callbacks, archived?, deleteDescription?, focusFallback?. Dependencies: UDropdownMenu, UButton, ConfirmButton. Focus returns to the menu trigger or a caller-owned fallback."
source="https://ui.nuxt.com/docs/components/dropdown-menu"
:code="'<ActionMenu :name=&quot;record.name&quot; :edit=&quot;edit&quot; :duplicate=&quot;duplicate&quot; :archive=&quot;archiveWithUndo&quot; :remove=&quot;remove&quot; />'">
      <div v-if="previewRecords.length" class="flex items-center justify-between"><span class="font-semibold">Example record <InlineStatus :label="previewRecords[0]!.status" /></span><ActionMenu
delete-description="This record will be removed from this demo. Refreshing restores the example data."
:focus-fallback="focusDemoHeading"
name="Example record"
:edit="() => { formMode = 'edit'; open = true }"
:duplicate="() => { formMode = 'create'; state.name = 'Example record (copy)'; open = true }"
:archived="previewRecords[0]!.status === 'Archived'"
:archive="archiveExample"
:remove="() => { previewRecords = []; toast.add({ title: 'Example deleted', color: 'success' }) }" /></div>
      <UEmpty
v-else
icon="i-lucide-trash-2"
title="Example deleted"
:actions="[{ label: 'Reset example', color: 'neutral', variant: 'outline', onClick: () => previewRecords = [{ id: 'preview', status: 'Active' }] }]" />
    </Example>
    <Example
title="Empty states · UEmpty"
rule="Distinguish a new collection from records hidden by filters."
rationale="The appropriate next action depends on why the list is empty."
contract="Native UEmpty title, description?, actions[], variant. Use creation for new data and Clear filters for hidden data; do not write a competing empty-state engine."
source="https://ui.nuxt.com/docs/components/empty"
:code="'<UEmpty title=&quot;No courses yet&quot; :actions=&quot;[{ label: \'New course\', to: \'/courses?new=1\' }]&quot; />'">
      <div class="grid gap-3 2xl:grid-cols-2"><UEmpty title="No courses yet" :actions="[{ label: 'New course', to: '/courses?new=1', color: 'neutral', variant: 'outline' }]" /><UEmpty
icon="i-lucide-search-x"
title="No matches"
description="3 courses hidden by filters"
:actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline', onClick: () => toast.add({ title: 'Filters cleared in this preview' }) }]" /></div>
    </Example>
    <Example
      title="ConfirmButton"
      rule="Confirm a major action beside its trigger."
      rationale="A local confirmation preserves context and prevents accidental execution. Pending and failure handling belongs in one reusable composition."
      contract="Props: title, description, action callback, icon, label?, confirmLabel, tone (error/primary), triggerColor (neutral/error), disabled, modelValue. Events: completed, update:modelValue. Dependencies: UButton, UPopover, UAlert."
      source="https://ui.nuxt.com/docs/components/popover"
      :code="'<ConfirmButton title=&quot;Delete course?&quot; description=&quot;This course will be removed.&quot; :action=&quot;deleteCourse&quot; />'"
    >
      <div class="flex gap-3">
        <ConfirmButton
:focus-fallback="focusDemoHeading"
          title="Delete example?"
          description="This is a demonstration; your courses are unaffected."
          :action="
            () => toast.add({ title: 'Example deleted', color: 'success' })
          "
        />
      </div>
    </Example>
    <Example
      title="EntityForm · UModal · UForm · UFormField"
      rule="Use the same fields for creation and editing."
      rationale="One schema keeps validation and labels consistent. The shell handles async submission, errors, dirty cancellation, and focus."
      contract="Props: presentation=modal|page, open? (modal), title, mode=create|edit, state, schema, valid?, submitLabel?, save, showDelete?, deleteAction?, deleteTitle?, deleteDescription?. Delete requires edit + showDelete + deleteAction. Events: update:open, saved, cancelled, deleted. Default slot receives pending. Dependencies: EntityFormContainer, ConfirmButton, Vue Router, native Nuxt UI components. See Page form for inline usage and failure controls."
      source="https://ui.nuxt.com/docs/components/form"
      :code="'<EntityForm v-model:open=&quot;open&quot; title=&quot;Edit record&quot; mode=&quot;edit&quot; :state=&quot;state&quot; :schema=&quot;schema&quot; :save=&quot;save&quot;>\n  <UFormField label=&quot;Name&quot; name=&quot;name&quot;><UInput v-model=&quot;state.name&quot; /></UFormField>\n</EntityForm>'"
    >
      <UButton
        label="New example"
        color="neutral"
        variant="outline"
        @click="formMode = 'create'; state.name = ''; open = true"
      /><UButton
label="Edit example"
color="neutral"
variant="outline"
class="ml-2"
@click="formMode = 'edit'; state.name = 'Example record'; open = true" /><EntityForm
v-model:open="open"
        :focus-fallback="focusDemoHeading"
        :title="formMode === 'edit' ? 'Edit example' : 'New example'"
        :mode="formMode"
        :valid="schema.safeParse(state).success"
        :submit-label="formMode === 'edit' ? 'Save changes' : 'Create example'"
        :state="state"
        :schema="schema"
        :save="saved"
        show-delete
        :delete-action="() => { previewRecords = []; toast.add({ title: 'Example deleted', color: 'success' }) }"
        delete-title="Delete example record?"
        ><UFormField
label="Name"
name="name"
required
          ><UInput v-model="state.name" autofocus class="w-full" /></UFormField
      ></EntityForm>
    </Example>
    <Example
      title="DataTable · UTable"
      rule="Use the existing table engine; share its row model with mobile."
      rationale="Native sorting, filtering, selection, expansion, and pagination remain consistent across layouts."
      contract="Props: data, native columns, title(item), to?, rowClickable=false, description?, archive?, remove?, filename, loading, view='table'|'cards', emptyTitle/emptyDescription/emptyActions, focusFallback. view changes presentation of one row model, so both views keep the same search, sorting, selection and pagination. rowClickable opts into guarded row navigation; identity links remain available. Slots: native table slots, expanded, actions-cell, card-leading, card-metadata, empty. Exposes tableApi and clear(). Dependencies: UTable, TanStack pagination, ListItem, Vue Router, rowNavigation.ts, UModal, csv.ts, native toolbar controls."
      source="https://ui.nuxt.com/docs/components/table"
      :code="'<DataTable :data=&quot;records&quot; :columns=&quot;columns&quot; :title=&quot;record => record.name&quot;>\n  <template #expanded=&quot;{ row }&quot;>{{ row.original.name }}</template>\n</DataTable>'"
    >
      <USwitch v-model="rowClickable" label="Enable whole-row navigation" class="mb-3" />
      <DataTable
        :data="samples"
        :row-clickable="rowClickable"
        :to="(r) => '/courses/c' + r.id"
        :columns="[
          { accessorKey: 'name', header: 'Name' },
          { accessorKey: 'status', header: 'Status' },
        ]"
        :title="(r) => r.name"
        ><template #name-cell="{ row }"><NuxtLink :to="'/courses/c' + row.original.id" class="font-semibold text-highlighted">{{ row.original.name }}</NuxtLink></template><template #expanded="{ row }"
          ><p class="p-3">{{ row.original.name }} · full details</p></template
        ><template #card-metadata="{ row }">{{
          row.original.status
        }}</template></DataTable
      >
    </Example>
    <Example
      title="ListItem"
      rule="Keep identity, metadata, and actions in predictable positions."
      rationale="The same composition serves compact lists, people, selectable records, expandable detail, and mobile cards."
      contract="Props: title, description?, to?, selectable, selected, expandable, expanded. Events: update:selected, update:expanded. Slots: leading, metadata, actions, expanded. Dependencies: UCheckbox, UButton, NuxtLink."
      :code="'<ListItem title=&quot;Alex Morgan&quot; description=&quot;Student&quot;>\n  <template #leading><UAvatar alt=&quot;Alex Morgan&quot; /></template>\n</ListItem>'"
    >
      <ListItem
        v-model:selected="selected"
        v-model:expanded="expanded"
        title="Alex Morgan"
        description="Biology 101"
        selectable
        expandable
        ><template #leading><UAvatar alt="Alex Morgan" /></template
        ><template #metadata
          ><UBadge variant="subtle" color="success">Active</UBadge
          ><span>3 credits</span></template
        ><template #expanded
          >Supporting details appear here when requested.</template
        ></ListItem
      >
    </Example>
    <Example
      title="PageHeader · dashboard shell"
      rule="Keep navigation context and page actions in the shared header."
      rationale="UDashboardGroup, UDashboardSidebar, UDashboardPanel, UDashboardNavbar, UDashboardToolbar and UDashboardSidebarCollapse compose the live shell around this gallery. Collapse the sidebar to try its alternate layout; on mobile use the native sidebar toggle."
      contract="PageHeader props: title, breadcrumbs (native BreadcrumbItem[]). Slots: actions and default toolbar. Dependencies: UDashboardNavbar, UDashboardToolbar, UDashboardSidebarCollapse, UBreadcrumb. Shared shell belongs in NuxtLayout."
      source="https://ui.nuxt.com/docs/components/dashboard-group"
      :code="'<UDashboardPanel>\n  <template #header><PageHeader title=&quot;Courses&quot; :breadcrumbs=&quot;breadcrumbs&quot; /></template>\n  <template #body><NuxtPage /></template>\n</UDashboardPanel>'"
    >
      <div class="overflow-hidden rounded-lg border border-default">
        <PageHeader
          title="Example page"
          :breadcrumbs="[
            { label: 'Courses', to: '/courses' },
            { label: 'Detail' },
          ]"
          ><template #actions
            ><UButton
              label="New record"
              icon="i-lucide-plus"
              @click="open = true" /></template
        ></PageHeader>
      </div>
    </Example>
    <Example
      title="UButton · UTooltip · UIcon"
      rule="Variant communicates priority; icons communicate familiar actions."
      rationale="Use primary solid, neutral outline, and neutral ghost consistently. Card-header utilities use neutral ghost. Tooltips supplement accessible names; the DataTable example demonstrates column visibility, CSV export, and expansion tooltips, and ActionMenu demonstrates contextual row-action tooltips."
      contract="UButton: label, icon, color, variant, size, loading, disabled, to; click event. UTooltip: text, default trigger slot. UIcon: name. Supported button sizes: xs for table utilities, sm/md for controls; larger touch targets via theme CSS."
      source="https://ui.nuxt.com/docs/components/button"
      :code="'<UButton label=&quot;New course&quot; icon=&quot;i-lucide-plus&quot; />\n<UButton label=&quot;Cancel&quot; color=&quot;neutral&quot; variant=&quot;outline&quot; />\n<UTooltip text=&quot;Edit&quot;><UButton icon=&quot;i-lucide-pencil&quot; aria-label=&quot;Edit course&quot; color=&quot;neutral&quot; variant=&quot;ghost&quot; /></UTooltip>'"
    >
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          label="New record"
          icon="i-lucide-plus"
          @click="open = true"
        /><UButton
          label="Secondary"
          color="neutral"
          variant="outline"
          @click="saved"
        /><UTooltip text="Edit"
          ><UButton
            icon="i-lucide-pencil"
            aria-label="Edit example"
            color="neutral"
            variant="ghost"
            @click="open = true" /></UTooltip
        ><UButton
          label="Delete"
          color="error"
          @click="
            toast.add({
              title: 'Use the ConfirmButton example for confirmation',
              color: 'info',
            })
          "
        /><UButton
          label="Documentation"
          to="https://ui.nuxt.com"
          target="_blank"
          variant="link"
        />
      </div>
    </Example>
    <Example
      title="UCard · UBadge"
      rule="Use outline for a distinct content group, soft for a quiet summary."
      rationale="A badge adds a readable status without competing with identity. Status uses subtle variants and semantic colors."
      contract="UCard: variant (outline/soft); header/default/footer slots. UBadge: color (primary/success/neutral/warning/error), variant=subtle; default text slot."
      source="https://ui.nuxt.com/docs/components/card"
      :code="'<UCard variant=&quot;outline&quot;>Entity summary</UCard>\n<UCard variant=&quot;soft&quot;>Metric summary</UCard>\n<UBadge color=&quot;success&quot; variant=&quot;subtle&quot;>Active</UBadge>'"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <UCard
          ><h3 class="font-medium">Entity summary</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            <UBadge
              v-for="color in [
                'primary',
                'success',
                'neutral',
                'warning',
                'error',
              ] as const"
              :key="color"
              :color="color"
              variant="subtle"
              >{{
                {
                  primary: "Planned",
                  success: "Active",
                  neutral: "Archived",
                  warning: "Pending",
                  error: "Failed",
                }[color]
              }}</UBadge
            >
          </div></UCard
        ><UCard variant="soft"
          ><p class="text-metric font-semibold">36</p>
          <p class="text-sm text-muted">Courses</p></UCard
        >
      </div>
    </Example>
    <Example
      title="Inputs · selection controls"
      rule="Label every field; choose the native control for its data."
      rationale="UInput and UTextarea accept text, UInputNumber handles numeric steps, USelect handles short fixed choices, USelectMenu searches larger or multiple choices, and UCheckbox selects independently."
      contract="All: modelValue/update:modelValue, disabled. Input: type, placeholder, icon. Textarea: rows. InputNumber: min/max. Select/SelectMenu: items, valueKey, multiple. Checkbox: aria-label or label, indeterminate state."
      source="https://ui.nuxt.com/docs/components/input"
      :code="'<UFormField label=&quot;Name&quot;><UInput v-model=&quot;name&quot; /></UFormField>\n<UFormField label=&quot;Credits&quot;><UInputNumber v-model=&quot;credits&quot; :min=&quot;1&quot; /></UFormField>\n<USelect v-model=&quot;status&quot; :items=&quot;[\'Active\', \'Archived\']&quot; aria-label=&quot;Status&quot; />'"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name"
          ><UInput v-model="query" class="w-full" /></UFormField
        ><UFormField label="Description"
          ><UTextarea v-model="query" class="w-full" /></UFormField
        ><UFormField label="Credits"
          ><UInputNumber v-model="number" :min="1" :max="12" /></UFormField
        ><UFormField label="Status"
          ><USelect
            v-model="choice"
            :items="['Active', 'Archived']"
            class="w-full" /></UFormField
        ><UFormField label="Searchable status"
          ><USelectMenu
            v-model="choice"
            :items="['Active', 'Archived']"
            class="w-full" /></UFormField
        ><UCheckbox v-model="selected" label="Selected" />
      </div>
    </Example>
    <Example
      title="UDropdownMenu · UPopover"
      rule="Group secondary actions in a menu; keep contextual interaction anchored."
      rationale="Menus show consistent readable verbs. Popovers hold a small interaction; modal forms belong in UModal."
      contract="DropdownMenu: native items/groups, content alignment; trigger slot. Popover: open/update:open, content, dismissible; trigger and content slots. ConfirmButton demonstrates click popovers above."
      source="https://ui.nuxt.com/docs/components/dropdown-menu"
      :code="'<UDropdownMenu :items=&quot;actions&quot;><UButton icon=&quot;i-lucide-ellipsis&quot; aria-label=&quot;Record actions&quot; color=&quot;neutral&quot; variant=&quot;ghost&quot; /></UDropdownMenu>'"
    >
      <UDropdownMenu
        :items="[
          [
            { label: 'Open', to: '/courses' },
            {
              label: 'Edit',
              icon: 'i-lucide-pencil',
              onSelect: () => (open = true),
            },
            {
              label: 'Duplicate',
              icon: 'i-lucide-copy',
              onSelect: () => {
                state.name += ' (copy)';
                open = true;
              },
            },
          ],
        ]"
        ><UButton
          icon="i-lucide-ellipsis"
          aria-label="Example actions"
          color="neutral"
          variant="outline"
      /></UDropdownMenu>
    </Example>
    <Example
      title="UNavigationMenu · UBreadcrumb · UTabs · UPagination"
      rule="Use links for destinations and tabs for local presentation, and give the active section a visible indicator."
      rationale="The gallery and course sections are real child routes. The game Cards/Table switch changes presentation locally. Pagination changes the slice of results. On a strip of short peer labels, highlight adds a moving underline so the active section is not carried by color alone."
      contract="NavigationMenu: items, children, orientation, collapsed, tooltip, popover, highlight, highlightColor. Breadcrumb: items. Tabs: items, modelValue, content=false. Pagination: page, total, itemsPerPage; update:page."
      source="https://ui.nuxt.com/docs/components/navigation-menu"
      :code="'<UNavigationMenu highlight :items=&quot;[{ label: \'Overview\', to: \'/courses/c1\' }, { label: \'Students\', to: \'/courses/c1/students\' }]&quot; />'"
    >
      <div class="space-y-4">
        <UBreadcrumb
          :items="[
            { label: 'Courses', to: '/courses' },
            { label: 'Biology', to: '/courses/c1' },
            { label: 'Students', to: '/courses/c1/students' },
          ]"
        /><UNavigationMenu
          highlight
          :items="[
            { label: 'Overview', to: '/courses/c1' },
            { label: 'Students', to: '/courses/c1/students' },
          ]"
        /><UTabs
          v-model="tab"
          :items="[
            { label: 'First view', value: 'one' },
            { label: 'Second view', value: 'two' },
          ]"
          :content="false"
          class="max-w-sm"
        /><UPagination v-model:page="page" :total="80" :items-per-page="25" />
      </div>
    </Example>
    <Example
      title="UAvatar · UAvatarGroup"
      rule="Use initials when portraits add no essential information."
      rationale="Names remain available through alternate text; groups summarize participants without repeated labels."
      contract="Avatar: alt, src?, size (xs/sm/md). AvatarGroup: default avatar slot. No remote portraits required."
      source="https://ui.nuxt.com/docs/components/avatar"
      :code="'<UAvatarGroup><UAvatar alt=&quot;Alex Morgan&quot; /><UAvatar alt=&quot;Jordan Lee&quot; /></UAvatarGroup>'"
      ><UAvatarGroup
        ><UAvatar alt="Alex Morgan" /><UAvatar alt="Jordan Lee" /><UAvatar
          alt="Sam Rivera" /></UAvatarGroup
    ></Example>
    <Example
      title="UAlert · USkeleton · useToast"
      rule="Place errors near the task and announce successful completion."
      rationale="Skeletons preserve structure during loading; alerts keep failure recoverable; success toasts confirm a completed operation."
      contract="Alert: title, color, variant=subtle, role=alert. Skeleton: class defines placeholder dimensions. useToast().add: title, color, duration. Pending/failed examples are on Interaction states."
      source="https://ui.nuxt.com/docs/components/alert"
      :code="'toast.add({ title: \'Course saved\', color: \'success\' })\n<UAlert title=&quot;Unable to save. Try again.&quot; color=&quot;error&quot; variant=&quot;subtle&quot; />'"
      ><div class="space-y-3">
        <UAlert
          title="Example failure — your input is preserved."
          color="error"
          variant="subtle"
        /><USkeleton class="h-4 w-40" /><UButton
          label="Try success toast"
          color="neutral"
          variant="outline"
          @click="saved"
        /></div
    ></Example>
    <Example
      title="Appearance menu · UColorModeSelect"
      rule="Offer light, dark and system, default to system, and render the control client-side."
      rationale="A two-state toggle silently drops system preference, so the shell footer uses an icon-only menu of all three. The resolved mode is unknown during server rendering, so a control that renders from the current preference lives inside ClientOnly with a stable fallback — system is the value that exposes the mismatch. UColorModeSelect stays available where a labelled control fits."
      contract="useColorMode().preference holds system/light/dark. DropdownMenu: checkbox items, content side/align; trigger slot. ClientOnly: default and fallback slots."
      source="https://ui.nuxt.com/docs/components/color-mode-select"
      :code="'<ClientOnly>\n  <UDropdownMenu :items=&quot;appearanceMenu&quot;>\n    <UButton icon=&quot;i-lucide-monitor&quot; aria-label=&quot;Appearance&quot; color=&quot;neutral&quot; variant=&quot;ghost&quot; />\n  </UDropdownMenu>\n  <template #fallback><UButton icon=&quot;i-lucide-monitor&quot; aria-label=&quot;Appearance&quot; color=&quot;neutral&quot; variant=&quot;ghost&quot; disabled /></template>\n</ClientOnly>'"
      ><div class="flex items-center gap-3">
        <ClientOnly>
          <UDropdownMenu :items="appearanceMenu">
            <UTooltip text="Appearance"><UButton
              icon="i-lucide-monitor"
              aria-label="Example appearance"
              color="neutral"
              variant="ghost"
            /></UTooltip>
          </UDropdownMenu>
          <template #fallback>
            <UButton
              icon="i-lucide-monitor"
              aria-label="Example appearance"
              color="neutral"
              variant="ghost"
              disabled
            />
          </template>
        </ClientOnly>
        <UColorModeSelect aria-label="Example color theme" /></div
    ></Example>
  </div>
</template>
