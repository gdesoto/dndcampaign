export interface ApiProp {
  name: string;
  type: string;
  default: string;
  description: string;
}

export interface ApiMember {
  name: string;
  signature: string;
  description: string;
}

export interface ComponentApi {
  name: string;
  group: 'Kit' | 'Demo' | 'Gallery';
  summary: string;
  dependencies: string;
  props: ApiProp[];
  events: ApiMember[];
  slots: ApiMember[];
  exposed?: ApiMember[];
  notes: string[];
  example: string;
}

const p = (name: string, type: string, fallback: string, description: string): ApiProp => ({ name, type, default: fallback, description });
const m = (name: string, signature: string, description: string): ApiMember => ({ name, signature, description });
const sfc = (imports: string, setup: string, template: string) => `<script setup lang="ts">\n${imports}${setup ? '\n' + setup : ''}\n</script>\n\n<template>\n${template}\n</template>`;
const kit = (name: string) => `import ${name} from '~/components/kit/${name}.vue';`;
const demo = (name: string) => `import ${name} from '~/components/demo/${name}.vue';`;
const focus = p('focusFallback', '() => void', 'undefined', 'Restore focus to a caller-owned element if the original trigger was removed.');
const openEvent = m('update:open', '(value: boolean) => void', 'Use v-model:open to keep the parent open state synchronized.');

// Keep this reference alongside the public contracts in components/{kit,demo,gallery}.
// “Required” means the caller must supply the prop; effective fallbacks are explicitly named.
export const componentApi: ComponentApi[] = [
  {
    name: 'ActionMenu', group: 'Kit',
    summary: 'A trailing record menu with optional actions and confirmed deletion.',
    dependencies: 'UDropdownMenu, UTooltip, UButton, ConfirmButton',
    props: [
      p('name', 'string', 'Required', 'Record name used in accessible labels and the delete title.'),
      p('to', 'string', 'undefined', 'Route for the Open item. Omit to hide Open.'),
      p('edit', '() => void', 'undefined', 'Show Edit and call this callback when selected.'),
      p('duplicate', '() => void', 'undefined', 'Show Duplicate and call this callback when selected.'),
      p('archive', '() => unknown', 'undefined', 'Show Archive. The caller performs the mutation and any Undo notification.'),
      p('remove', '() => unknown', 'undefined', 'Show Delete. Called and awaited by ConfirmButton after confirmation; may return a promise.'),
      p('archived', 'boolean', 'false', 'Disable Archive for an already archived record.'),
      p('deleteDescription', 'string', 'undefined → “Delete this record?”', 'Confirmation copy. An empty string also uses the fallback.'),
      focus,
    ], events: [], slots: [],
    notes: ['Items appear in Open, Edit, Duplicate, Archive, Delete order. With no actions or route, nothing renders.', 'Actions are callback props, not emitted events. Archive/Edit/Duplicate have no built-in async error UI. Delete errors remain in the confirmation popover.'],
    example: sfc(kit('ActionMenu') + '\nimport { ref } from "vue";', `const archived = ref(false);\nconst removed = ref(false);\nconst heading = ref<HTMLElement | null>(null);`, `  <h2 ref="heading" tabindex="-1">Records</h2>\n  <ActionMenu v-if="!removed" name="Biology" to="/courses"\n    :archived="archived" :archive="() => { archived = true }"\n    :remove="async () => { removed = true }"\n    :focus-fallback="() => heading?.focus()"\n    delete-description="Remove this example record?" />`),
  },
  {
    name: 'ConfirmButton', group: 'Kit',
    summary: 'A button and confirmation popover that await an action and retain failures for retry.',
    dependencies: 'UPopover, UTooltip, UButton, UAlert',
    props: [
      p('title', 'string', 'Required', 'Confirmation heading and trigger aria-label.'),
      p('description', 'string', 'Required', 'Explain the consequences of confirming.'),
      p('action', '() => Promise<unknown> | unknown', 'Required', 'Awaited on confirm. Throw/reject to show an error and keep the popover open.'),
      p('label', 'string', 'undefined', 'Trigger text; omitted for an icon-only trigger.'),
      p('icon', 'string', '"i-lucide-trash-2"', 'Iconify name for the trigger.'),
      p('confirmLabel', 'string', '"Delete"', 'Text on the confirmation action.'),
      p('disabled', 'boolean', 'false', 'Disable the trigger. Pending actions also disable it.'),
      p('tooltip', 'string', 'undefined', 'Optional trigger tooltip; absent or empty disables it.'),
      p('tone', '"error" | "primary"', '"error"', 'Semantic color of the confirmation action.'),
      p('triggerColor', '"neutral" | "error"', '"neutral"', 'Color of the trigger. Stays neutral unless the trigger is half of a visible decision pair.'),
      p('modelValue', 'boolean', 'undefined; internal open state starts false', 'Use v-model for controlled open state, or omit for internal state.'),
      focus,
    ],
    events: [m('update:modelValue', '(value: boolean) => void', 'Emitted when the wrapper changes open state; use v-model.'), m('completed', '() => void', 'Emitted only after action resolves successfully and the popover is closed.')], slots: [],
    notes: ['Opening focuses Cancel. Dismissal and repeated execution are blocked while pending.', 'The action return value is ignored. Successful execution restores trigger focus or calls focusFallback.'],
    example: sfc(kit('ConfirmButton') + '\nimport { ref } from "vue";', `const open = ref(false);\nconst message = ref('Ready');`, `  <ConfirmButton v-model="open" title="Apply changes?"\n    description="Apply the changes to this example."\n    label="Apply" icon="i-lucide-check" confirm-label="Apply" tone="primary"\n    :action="async () => { message = 'Applied' }"\n    @completed="message = 'Completed successfully'" />\n  <p role="status">{{ message }}</p>`),
  },
  {
    name: 'DataTable', group: 'Kit',
    summary: 'One client-side row model for desktop tables and mobile cards, with filtering, selection, expansion, pagination, and CSV export.',
    dependencies: 'UTable and native controls, USlideover, @tanstack/vue-table, ListItem, rowNavigation.ts, csv.ts, Vue Router',
    props: [
      p('data', 'T[]; T extends { id: string }', 'Required', 'Rows with stable, unique string IDs. No server-side data fetching is performed.'),
      p('columns', 'TableColumn<T>[]', 'Required', 'Nuxt UI / TanStack column definitions. Accessor columns participate in filters, visibility controls, and export.'),
      p('title', '(item: T) => string', 'Required', 'Record identity for mobile titles and accessible selection/expansion labels.'),
      p('to', '(item: T) => string', 'undefined', 'Mobile title link and optional whole-row route. Desktop title links belong in a cell slot.'),
      p('description', '(item: T) => string', 'undefined', 'Card description; suppressed when an expanded slot is supplied.'),
      p('archive', '(items: T[]) => Promise<unknown> | unknown', 'undefined', 'Enable bulk Archive. Receives filtered selected records; implement persistence and Undo in the caller.'),
      p('remove', '(items: T[]) => Promise<unknown> | unknown', 'undefined', 'Enable confirmed bulk Delete. Rejections appear in the confirmation modal.'),
      p('filename', 'string', '"records.csv"', 'Downloaded CSV filename.'),
      p('deleteDescription', 'string', 'undefined → “Delete the selected records?”', 'Bulk-delete confirmation text; empty string also uses the fallback.'),
      p('loading', 'boolean', 'false', 'Native table loading on desktop and skeleton cards on mobile.'),
      p('rowClickable', 'boolean', 'false', 'Enable ordinary row clicks only when to is supplied. Interactive descendants, modified clicks, and selected text are ignored.'),
      p('view', '"table" | "cards"', '"table"', 'Presentation of the same row model. "cards" renders the card layout at every width; "table" keeps cards below md. Search, sorting, selection, pagination and export are shared by both.'),
      p('emptyIcon', 'string', 'undefined → "i-lucide-inbox"', 'Icon for a resolved empty collection; name the thing that is missing. The no-matches state uses a search icon.'),
      p('emptyTitle', 'string', 'undefined → "No records yet"', 'Title for a resolved empty collection. The no-matches state is owned by the wrapper.'),
      p('emptyDescription', 'string', 'undefined', 'Supporting line for a resolved empty collection.'),
      p('emptyActions', 'ButtonProps[]', 'undefined', 'Creation action offered when the collection is genuinely empty. A filtered-out collection is offered Clear filters instead.'),
      p('focusFallback', '() => void', 'undefined', 'Focus destination after a bulk action, whose selection toolbar unmounts with the selection it acted on.'),
    ], events: [],
    slots: [
      m('<column-id>-cell', 'UTable cell scope, including { row, column, getValue }', 'Customize desktop cells; read the original record as row.original.'),
      m('<column-id>-header', 'UTable header scope, including { column, header }', 'Override a desktop column header. String accessor headers otherwise get a sorting button.'),
      m('actions-cell', '{ row: Row<T> } on both layouts', 'Adds the desktop actions column and mobile trailing actions. Desktop also supplies the UTable cell scope.'),
      m('expanded', '{ row: Row<T> }', 'Its presence adds expansion controls to both layouts; content renders when expanded.'),
      m('card-metadata', '{ row: Row<T>, visibleColumns: string[] }', 'Metadata for the card layout. Respect visibleColumns to mirror table column visibility.'),
      m('card-leading', '{ row: Row<T> }', 'Leading element of a card, such as an avatar. Its presence adds the ListItem leading slot.'),
      m('empty', '{ title, description, actions, filtered, clear }', 'Replaces the resolved empty state on both layouts. The default renders UEmpty from the resolved contract; filtered distinguishes no matches from no records.'),
      m('Other UTable slots', 'The native slot scope', 'Named slots are forwarded to the table. empty is resolved by the wrapper rather than forwarded, so its no-records / no-matches contract holds.'),
    ],
    exposed: [m('tableApi', 'Table<T> | undefined', 'Template-ref access to the TanStack API after mount; Vue unwraps the exposed computed ref.'), m('clear', '() => void', 'Clear global search, column filters, and the active filter column; filter watchers reset selection and page index.')],
    notes: ['No wrapper events or public v-model bindings. Sorting, filtering, visibility, selection, expansion, and pagination are internal; advanced callers can use tableApi.', 'Search stays inline at every width. Below md the column filter moves into a native USlideover whose trigger carries the active filter count; the same filter state drives both layouts, so no second filtering path exists.', 'Page size starts at 25; UI options are 10, 25, 50. Search/filter changes clear selection and return to page one. Bulk actions clear selection after success.', 'CSV exports visible accessor columns and either all filtered/sorted rows across pages or filtered selected rows. With view="table" the table shows at md and larger and cards below it; with view="cards" the card grid is used at every width.', 'Reserve selection, expansion, and actions column IDs for wrapper controls. Native UTable props are not generally forwarded through the root div. Handle archive errors in your callback.'],
    example: sfc(kit('DataTable') + '\n' + kit('InlineStatus') + '\nimport { ref } from "vue";\nimport type { TableColumn } from "@nuxt/ui";', `type RecordRow = { id: string; name: string; status: string };\nconst records = ref<RecordRow[]>([\n  { id: '1', name: 'Biology', status: 'Active' },\n  { id: '2', name: 'Writing', status: 'Archived' }\n]);\nconst columns: TableColumn<RecordRow>[] = [\n  { accessorKey: 'name', header: 'Name' },\n  { accessorKey: 'status', header: 'Status' }\n];\nasync function remove(items: RecordRow[]) {\n  const ids = new Set(items.map(item => item.id));\n  records.value = records.value.filter(item => !ids.has(item.id));\n}`, `  <DataTable :data="records" :columns="columns" :title="item => item.name"\n    :remove="remove" filename="courses.csv">\n    <template #status-cell="{ row }">\n      <InlineStatus :label="row.original.status" />\n    </template>\n    <template #card-metadata="{ row, visibleColumns }">\n      <InlineStatus v-if="visibleColumns.includes('status')" :label="row.original.status" />\n    </template>\n    <template #expanded="{ row }">Record ID: {{ row.original.id }}</template>\n  </DataTable>`),
  },
  {
    name: 'DetailPanel', group: 'Kit', summary: 'A labeled fact list in a card, with per-fact formatting and optional actions.',
    dependencies: 'UCard',
    props: [p('title', 'string', 'Required', 'Panel heading.'), p('facts', '{ label: string; value: string | number }[]', 'Required', 'Ordered facts. Use unique labels: each label is both the list key and its dynamic slot name.')],
    events: [], slots: [m('actions', 'No slot props', 'Trailing header actions.'), m('<fact.label>', '{ fact: { label: string; value: string | number } }', 'Override a fact value. Defaults to fact.value.'), m('default', 'No slot props', 'Additional content after the fact list.')],
    notes: ['Values render as text by default; use a fact slot for links or badges.'],
    example: sfc(kit('DetailPanel') + '\n' + kit('InlineStatus'), '', `  <DetailPanel title="Course details"\n    :facts="[{ label: 'Credits', value: 3 }, { label: 'Status', value: 'Active' }]">\n    <template #Status="{ fact }"><InlineStatus :label="String(fact.value)" color="success" /></template>\n    <template #actions><UButton to="/courses" label="View courses" variant="ghost" /></template>\n    <p class="mt-3 text-sm text-muted">Updated today.</p>\n  </DetailPanel>`),
  },
  {
    name: 'EntityForm', group: 'Kit', summary: 'Shared create/edit form with validation, async saving, dirty navigation guards, and optional confirmed deletion.',
    dependencies: 'EntityFormContainer, ConfirmButton, UForm, UAlert, UButton, Vue Router',
    props: [
      p('title', 'string', 'Required', 'Modal heading or page section accessible label.'),
      p('mode', '"create" | "edit"', 'Required', 'Controls default submit text, pristine edit disabling, and delete eligibility.'),
      p('state', 'Record<string, unknown>', 'Required', 'Caller-owned reactive draft. Bind field inputs to this object.'),
      p('schema', 'object', 'Required', 'UForm-compatible validation schema, such as a Zod object schema.'),
      p('save', '() => Promise<unknown> | unknown', 'Required', 'Called after successful validation. Read and persist state in this callback; no payload is passed.'),
      p('open', 'boolean', 'false', 'Modal visibility; bind with v-model:open. Page presentation stays active regardless.'),
      p('presentation', '"modal" | "page"', 'undefined → "modal"', 'Select modal or inline page rendering.'),
      p('showDelete', 'boolean', 'false', 'Opt into deletion; also requires edit mode and deleteAction.'),
      p('deleteAction', '() => Promise<unknown> | unknown', 'undefined', 'Awaited after confirmation. Rejections stay in the confirmation UI.'),
      p('deleteTitle', 'string', 'undefined → “Delete record?”', 'Delete confirmation title; empty string uses the fallback.'),
      p('deleteDescription', 'string', 'undefined → “This record will be permanently deleted. Unsaved changes will be discarded.”', 'Delete consequences; empty string uses the fallback.'),
      p('submitLabel', 'string', 'undefined → “Save changes” (edit) / “Create record” (create)', 'Override submit text; empty string uses the mode default.'),
      p('valid', 'boolean', 'false when omitted (Vue Boolean casting)', 'Pass true or a reactive validity expression to enable submit. Only explicit true passes the valid === false gate; schema validation still runs.'),
      p('serializeState', '(state: Record<string, unknown>) => string', 'undefined → JSON.stringify', 'Stable dirty-state serialization. Supply a custom serializer for rich values such as Files or Maps.'),
      focus,
    ],
    events: [openEvent, m('saved', '() => void', 'After save resolves; modal then emits update:open(false). Page remains inline.'), m('cancelled', '() => void', 'After clean cancellation or accepted discard; modal then emits update:open(false).'), m('deleted', '() => void', 'After confirmed deletion succeeds; modal then emits update:open(false).')],
    slots: [m('default', '{ pending: boolean }', 'Form fields inside a disabled-while-busy fieldset. pending covers both saving and deleting.')],
    notes: ['Validation runs on blur and submit; the first validation error receives focus. Rejected saves keep the draft and show an error.', 'Edit submission requires a dirty draft as well as valid=true. Save resets the dirty baseline. Page callers handle navigation/removal in saved, cancelled, and deleted listeners.', 'Discard approves cancellation or route navigation; it does not restore the state object. Keep draft state separate from persisted data. The route guard handles in-app navigation, not browser tab closing.', 'No arbitrary UForm props, native submit/error events, footer slots, or imperative methods are forwarded as a wrapper API.'],
    example: sfc(kit('EntityForm') + '\nimport { reactive, ref } from "vue";\nimport { z } from "zod";', `const open = ref(false);\nconst state = reactive({ name: '' });\nconst schema = z.object({ name: z.string().trim().min(1, 'Enter a name') });\nconst savedName = ref('');\nasync function save() { savedName.value = schema.parse(state).name; }`, `  <UButton label="New record" @click="state.name = ''; open = true" />\n  <EntityForm v-model:open="open" title="New record" mode="create"\n    :state="state" :schema="schema" :valid="schema.safeParse(state).success" :save="save">\n    <template #default="{ pending }">\n      <UFormField name="name" label="Name" required>\n        <UInput v-model="state.name" :disabled="pending" class="w-full" />\n      </UFormField>\n    </template>\n  </EntityForm>\n  <p role="status">Saved: {{ savedName }}</p>`),
  },
  {
    name: 'EntityFormContainer', group: 'Kit', summary: 'Presentation-only shell used by EntityForm for modal or inline forms.',
    dependencies: 'UModal',
    props: [p('presentation', '"modal" | "page"', 'Required', 'Page renders a labeled section; modal renders UModal.'), p('open', 'boolean', 'Required', 'Modal open state; ignored in page mode.'), p('title', 'string', 'Required', 'Modal heading or section aria-label.'), p('busy', 'boolean', 'Required', 'Disable modal dismissal and close button while true.')],
    events: [m('close', '() => void', 'Modal requested closure; the parent must update open. No close control is rendered in page mode.')],
    slots: [m('default', 'No slot props', 'Content inside the modal body or page section.')],
    notes: ['No validation, saving, dirty tracking, or deletion behavior. Use EntityForm when those behaviors are needed.'],
    example: sfc(kit('EntityFormContainer') + '\nimport { ref } from "vue";', 'const open = ref(false);', `  <UButton label="Open panel" @click="open = true" />\n  <EntityFormContainer presentation="modal" :open="open" title="Information"\n    :busy="false" @close="open = false">\n    <p>Caller-owned content.</p>\n  </EntityFormContainer>`),
  },
  {
    name: 'InlineStatus', group: 'Kit', summary: 'A compact semantic badge with a decorative dot and visible status text.',
    dependencies: 'UBadge',
    props: [p('label', 'string', 'Required', 'Visible status text; color never replaces the label.'), p('color', '"success" | "warning" | "error" | "info" | "neutral" | "primary"', '"neutral"', 'Supported semantic colors. secondary is not part of this wrapper contract.')],
    events: [], slots: [], notes: ['Badge variant is fixed to subtle. The wrapper does not infer a color from label.'],
    example: sfc(kit('InlineStatus'), '', `  <InlineStatus label="Active" color="success" />\n  <InlineStatus label="Needs review" color="warning" />\n  <InlineStatus label="Draft" />`),
  },
  {
    name: 'ListItem', group: 'Kit', summary: 'A responsive record row or card with controlled selection and expansion.',
    dependencies: 'UCheckbox, UTooltip, UButton, NuxtLink, rowNavigation.ts, Vue Router',
    props: [
      p('title', 'string', 'Required', 'Primary identity and accessible control labels.'),
      p('description', 'string', 'undefined', 'Supporting text; clamped to two lines while expandable and collapsed.'),
      p('to', 'string', 'undefined', 'Render title as a NuxtLink.'),
      p('rowClickable', 'boolean', 'false', 'Enable ordinary whole-row clicks when to exists; title links remain available independently.'),
      p('selected', 'boolean', 'false', 'Controlled checkbox state. Bind with v-model:selected.'),
      p('selectable', 'boolean', 'false', 'Show the selection checkbox.'),
      p('expanded', 'boolean', 'false', 'Controlled expanded-content visibility. Bind with v-model:expanded.'),
      p('expandable', 'boolean', 'false', 'Show the expansion toggle. Expanded content itself is gated by expanded.'),
      p('variant', '"row" | "card"', 'undefined → "row" appearance', 'Row uses a bottom divider; card adds a border, background, and horizontal padding.'),
    ],
    events: [m('update:selected', '(value: boolean) => void', 'Checkbox changes; wrapper does not retain selection internally.'), m('update:expanded', '(value: boolean) => void', 'Expansion toggle changes; wrapper does not retain expansion internally.')],
    slots: [m('leading', 'No slot props', 'Leading visual beside the selection control.'), m('metadata', 'No slot props', 'Wrapping metadata beneath description.'), m('actions', 'No slot props', 'Trailing record controls.'), m('expanded', 'No slot props', 'Content below the row when expanded=true.')],
    notes: ['No default slot. Use named slots for content. Interactive controls, modified clicks, and text selection do not trigger whole-row navigation.'],
    example: sfc(kit('ListItem') + '\n' + kit('InlineStatus') + '\nimport { ref } from "vue";', 'const selected = ref(false);\nconst expanded = ref(false);', `  <ListItem v-model:selected="selected" v-model:expanded="expanded"\n    title="Biology" description="An introduction to living systems."\n    to="/courses" variant="card" selectable expandable>\n    <template #metadata><InlineStatus label="Active" color="success" /><span>3 credits</span></template>\n    <template #expanded><p>Additional course details.</p></template>\n  </ListItem>`),
  },
  {
    name: 'PageHeader', group: 'Kit', summary: 'Dashboard page heading with breadcrumbs, a count, actions, and an optional toolbar.',
    dependencies: 'UDashboardNavbar, UDashboardSidebarCollapse, UBreadcrumb, UDashboardToolbar',
    props: [p('title', 'string', 'Required', 'Visible h1 and navbar title.'), p('count', 'string | number', 'undefined', 'Optional count beside the title; zero is displayed.'), p('breadcrumbs', 'BreadcrumbItem[]', 'undefined', 'Native Nuxt UI breadcrumb items, for example { label, to }. Omitted or empty hides breadcrumbs.')],
    events: [], slots: [m('actions', 'No slot props', 'Right-aligned navbar actions.'), m('default', 'No slot props', 'Creates a dashboard toolbar beneath the navbar.')],
    notes: ['Use in a UDashboardPanel header inside a UDashboardGroup. The h1 is programmatically focusable and marked data-focus-fallback.', 'Multiple root nodes mean arbitrary attributes are not automatically routed to a single underlying element.'],
    example: sfc(kit('PageHeader'), '', `  <UDashboardPanel id="api-header-example">\n    <template #header>\n      <PageHeader title="Courses" :count="12"\n        :breadcrumbs="[{ label: 'Courses', to: '/courses' }, { label: 'Catalog' }]">\n        <template #actions><UButton label="New course" to="/courses?new=1" /></template>\n        <UNavigationMenu :items="[{ label: 'Catalog', to: '/courses' }]" />\n      </PageHeader>\n    </template>\n    <template #body>Page content.</template>\n  </UDashboardPanel>`),
  },
  {
    name: 'StatCard', group: 'Kit', summary: 'A metric card with optional icon, exception tone, delta text, single or segmented progress, and supporting content.',
    dependencies: 'UCard, UProgress, UProgressGroup, UIcon',
    props: [p('label', 'string', 'Required', 'Metric label and progress accessible label.'), p('icon', 'string', 'undefined', "Names the metric's subject, never its chartness: a generic chart or trend glyph varies with nothing and is decoration. Use icons for every card in a row or none, so no card gains emphasis it has not earned."), p('tone', "'neutral' | 'success' | 'warning' | 'error' | 'info'", "'neutral'", 'Colors the icon and value while the metric is genuinely an exception. Bind it to the condition rather than setting it permanently.'), p('value', 'string | number', 'Required', 'Displayed metric; caller formats units.'), p('delta', 'string', 'undefined', 'Supporting text beside the value; empty string hides it.'), p('progress', 'number', 'undefined', 'Optional determinate progress, conventionally 0–100 (native UProgress default max=100). Zero is visible; the wrapper performs no range validation.'), p('segments', 'ProgressGroupItem[]', 'undefined', 'Shares of one total, rendered by native UProgressGroup: label, value and optional color per segment. Use it when the split is the answer — occupied/available capacity — rather than a single share.'), p('max', 'number', 'undefined → 100', 'Total the segments add up to, forwarded to UProgressGroup. Values are clamped by the native component.')],
    events: [], slots: [m('default', 'No slot props', 'Supporting content below the metric/progress.')],
    notes: ['No delta-direction prop. Delta text uses a neutral muted style.', 'progress and segments are mutually exclusive; progress wins if both are supplied. max applies to segments only.', 'tone is the only color input and is meant to be conditional: a card permanently colored warning stops reading as an exception.'],
    example: sfc(kit('StatCard'), '', `  <StatCard icon="i-lucide-users" label="Enrollment" :value="72" delta="+8 this term" :progress="72">\n    <p class="text-xs text-muted">72 of 100 seats filled</p>\n  </StatCard>`),
  },
  {
    name: 'CourseForm', group: 'Demo', summary: 'Course-specific modal that persists to the example app’s shared course state.',
    dependencies: 'EntityForm, Zod, useDemo, useAcademics, useToast, focusDemoHeading, native form controls',
    props: [p('open', 'boolean', 'Required', 'Bind with v-model:open; opening initializes the draft.'), p('course', 'Course', 'undefined', 'Existing course to edit, or source to duplicate. Type is exported from app/composables/useDemo.ts.'), p('duplicate', 'boolean', 'false', 'With course, use create mode, append “ (copy)” to name, and clear studentIds.')],
    events: [openEvent], slots: [],
    notes: ['New defaults: name/description/instructor empty, credits=3, department=Science, startsOn=2026-09-21, studentIds=[]. Department UI options: Science, Humanities, Mathematics, Arts, Technology.', 'Name and description are required after trimming; credits must be an integer 1–12; department must be nonempty. Date validation checks YYYY-MM-DD format. Students are selectable only in edit mode.', 'Course shape: id, name, description, department, instructor, startsOn (strings), credits (number), studentIds (string[]), status (Active | Archived). Save errors stay in the form; successful saves show a toast. No saved event is forwarded.', 'Editing enrollment removes deselected students from that course’s sections. This component depends on demo state and is not a portable kit wrapper.'],
    example: sfc(demo('CourseForm') + '\nimport { ref } from "vue";', 'const open = ref(false);', `  <UButton label="New course" @click="open = true" />\n  <CourseForm v-model:open="open" />`),
  },
  {
    name: 'SectionForm', group: 'Demo', summary: 'Section-specific modal for creating and editing course sections.',
    dependencies: 'EntityForm, Zod, useDemo, useAcademics, publicationBlocker, useToast, focusDemoHeading',
    props: [p('open', 'boolean', 'Required', 'Bind with v-model:open; opening initializes the draft.'), p('section', 'Section', 'undefined', 'Existing section to edit. Its values take precedence over courseId; type is exported from app/utils/academicRules.ts.'), p('courseId', 'string', 'undefined', 'Preferred course for creation; falls back to the first Active course, then an empty ID if none exists.')],
    events: [openEvent], slots: [],
    notes: ['New defaults: name/room/schedule empty, instructor from the chosen course or empty, capacity=12. Course selection is disabled while editing.', 'Course ID, trimmed name, and trimmed schedule are required. Capacity is an integer 1–200. Name must be unique within a course (case-insensitive); course must exist. Instructor and room may be empty in a draft.', 'Section shape: id, courseId, name, instructor, room, schedule (strings), capacity (number), studentIds (string[]), published (boolean). New sections use studentIds=[] and published=false.', 'Edits that leave missing instructor/room or over-capacity enrollment unpublish the section. Saves mutate demo state and show a toast; saved is not forwarded.'],
    example: sfc(demo('SectionForm') + '\nimport { ref } from "vue";', 'const open = ref(false);', `  <UButton label="New section" @click="open = true" />\n  <SectionForm v-model:open="open" />`),
  },
  {
    name: 'SessionForm', group: 'Demo', summary: 'Game-planning session modal with create, edit, and duplicate flows.',
    dependencies: 'EntityForm, Zod, useDemo, useToast, focusDemoHeading, native form controls',
    props: [p('open', 'boolean', 'Required', 'Bind with v-model:open; opening initializes the draft.'), p('session', 'GameSession', 'undefined', 'Existing session or duplication source. Type is exported from app/composables/useDemo.ts.'), p('duplicate', 'boolean', 'false', 'With session, create a new record, append “ (copy)” to title, and clear participantIds.')],
    events: [openEvent], slots: [],
    notes: ['New defaults: title/description empty, scheduledAt=2026-09-20T18:00, participantIds=[]. New saved sessions have status=Planned.', 'Trimmed title and description must be nonempty; scheduledAt must be nonempty. Participants are selectable only when editing, from demo students.', 'GameSession shape: id, title, description, scheduledAt (strings), participantIds (string[]), status (Planned | Archived). Saves mutate demo state and show a toast; saved is not forwarded.'],
    example: sfc(demo('SessionForm') + '\nimport { ref } from "vue";', 'const open = ref(false);', `  <UButton label="New session" @click="open = true" />\n  <SessionForm v-model:open="open" />`),
  },
  {
    name: 'SectionCard', group: 'Demo', summary: 'Course-section summary with enrollment, publication status, and an Edit action.',
    dependencies: 'UCard, UProgress, UDropdownMenu, UButton, InlineStatus, useAcademics, useToast, statusColor',
    props: [p('section', 'Section', 'Required', 'Section record from app/utils/academicRules.ts; courseId must resolve in demo course state for the course title.')],
    events: [m('edit', '(section: Section) => void', 'The selected section; parent opens and owns the editor.')], slots: [],
    notes: ['Uses the Section shape documented under SectionForm. Shows instructor, room, schedule, occupied seats, and Published/Draft or a publication blocker.', 'Publish appears only for an unpublished section without an issue whose course is Active. Publishing mutates demo state directly; failures show a toast. No publish event or custom card slots are forwarded.'],
    example: sfc(demo('SectionCard') + '\n' + demo('SectionForm') + '\nimport { ref } from "vue";\nimport type { Section } from "~/utils/academicRules";', `const { sections } = useAcademics();\nconst editing = ref<Section>();\nconst open = ref(false);\nfunction edit(section: Section) { editing.value = section; open.value = true; }`, `  <SectionCard v-for="section in sections" :key="section.id" :section="section" @edit="edit" />\n  <SectionForm v-model:open="open" :section="editing" />`),
  },
  {
    name: 'Example', group: 'Gallery', summary: 'Gallery documentation frame pairing a live preview with guidance and copyable source.',
    dependencies: 'UButton, UTooltip, useToast, browser Clipboard API',
    props: [p('title', 'string', 'Required', 'Example heading.'), p('rule', 'string', 'Required', 'Short design rule.'), p('rationale', 'string', 'Required', 'Why the rule exists.'), p('contract', 'string', 'Required', 'Summary of the public API and dependencies.'), p('source', 'string', 'undefined', 'Optional upstream documentation URL, opened in a new tab.'), p('code', 'string', 'Required', 'Displayed source and clipboard content; rendered as text, never executed.')],
    events: [], slots: [m('default', 'No slot props', 'Live preview beside the annotations; stacked on smaller screens.')],
    notes: ['Copy success shows a toast. If clipboard access fails, the user is prompted to select and copy the displayed source.'],
    example: sfc(`import Example from '~/components/gallery/Example.vue';\n${kit('InlineStatus')}`, `const code = '<InlineStatus label="Draft" />';`, `  <Example title="Draft status" rule="Always include a status word."\n    rationale="Color alone does not communicate status to everyone."\n    contract="InlineStatus accepts label and optional color." :code="code">\n    <InlineStatus label="Draft" />\n  </Example>`),
  },
];
