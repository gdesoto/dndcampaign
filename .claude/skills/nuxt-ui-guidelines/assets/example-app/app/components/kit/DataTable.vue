<script setup lang="ts" generic="T extends { id: string }">
import { ref, computed, watch, useTemplateRef, useSlots, nextTick } from "vue";
import type { TableColumn, ButtonProps } from "@nuxt/ui";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type {
  Table,
  Row,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  ExpandedState,
} from "@tanstack/vue-table";
import ListItem from "./ListItem.vue";
import { useRouter } from 'vue-router';
import { canNavigateRow } from './rowNavigation';
import { downloadCsv } from "./csv";
const props = withDefaults(
  defineProps<{
    data: T[];
    columns: TableColumn<T>[];
    title: (item: T) => string;
    to?: (item: T) => string;
    description?: (item: T) => string;
    archive?: (items: T[]) => Promise<unknown> | unknown;
    remove?: (items: T[]) => Promise<unknown> | unknown;
    filename?: string;
    deleteDescription?: string;
    loading?: boolean;
    rowClickable?: boolean;
    view?: "table" | "cards";
    emptyIcon?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyActions?: ButtonProps[];
    focusFallback?: () => void;
  }>(),
  {
    deleteDescription: undefined,
    filename: "records.csv",
    to: undefined,
    description: undefined,
    archive: undefined,
    remove: undefined,
    view: "table",
    emptyIcon: undefined,
    emptyTitle: undefined,
    emptyDescription: undefined,
    emptyActions: undefined,
    focusFallback: undefined,
  },
);
const table = useTemplateRef<{ tableApi: Table<T> }>("table");
const slots = useSlots();
const router = useRouter();
function openRow(event: Event, row: Row<T>) {
  if (!props.rowClickable || !props.to || !canNavigateRow(event, window.getSelection()?.toString())) return;
  void router.push(props.to(row.original));
}
const search = ref("");
const sorting = ref<SortingState>([]);
const filters = ref<ColumnFiltersState>([]);
const visibility = ref<VisibilityState>({});
const selection = ref<RowSelectionState>({});
const expanded = ref<ExpandedState>({});
const pagination = ref({ pageIndex: 0, pageSize: 25 });
const filterColumn = ref("");
// Mobile search stays inline; the column filter moves into a native slideover
// so the toolbar keeps one row on a phone. The trigger carries the active
// filter count, because a filter you cannot see is a filter you forget.
const filtersOpen = ref(false);
const bulkOpen = ref(false);
const bulkPending = ref(false);
const bulkError = ref("");
const bulkCancel = ref<{ $el: HTMLElement } | null>(null);
function focusBulkCancel(event: Event) {
  event.preventDefault();
  void nextTick(() => bulkCancel.value?.$el.focus());
}
async function deleteSelected() {
  if (!props.remove || bulkPending.value) return;
  bulkPending.value = true;
  bulkError.value = '';
  try { await bulk(props.remove); bulkOpen.value = false; }
  catch (error) { bulkError.value = error instanceof Error ? error.message : 'Unable to delete. Try again.'; }
  finally { bulkPending.value = false; }
}
// Completing a bulk action clears the selection, so its toolbar unmounts with
// the trigger. The host names the surviving control that should receive focus.
async function restoreFocus() {
  await nextTick();
  props.focusFallback?.();
}
function numeric(id: string) {
  return props.data.length > 0 && typeof api.value?.getCoreRowModel().rows[0]?.getValue(id) === 'number';
}
const api = computed(() => table.value?.tableApi);
const rows = computed(() => api.value?.getRowModel().rows ?? []);
const selected = computed(
  () => api.value?.getFilteredSelectedRowModel().rows ?? [],
);
const count = computed(() => api.value?.getFilteredRowModel().rows.length ?? 0);
// Native column metadata keeps utility columns content-sized in an auto-layout table.
const controlMeta = { class: { th: 'w-px whitespace-nowrap px-2', td: 'w-px whitespace-nowrap px-2' } };
const columnsWithControls = computed<TableColumn<T>[]>(() => [
  {
    id: "selection",
    meta: controlMeta,
    header: "",
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
  },
  ...(slots.expanded ? [{
    id: "expansion",
    meta: controlMeta,
    header: "",
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
  }] : []),
  ...props.columns,
  ...(slots["actions-cell"] ? [{
    id: "actions",
    meta: controlMeta,
    header: "",
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
  }] : []),
]);
const dataColumns = computed(
  () => api.value?.getAllLeafColumns().filter((c) => c.accessorFn) ?? [],
);
const columnOptions = computed(() =>
  dataColumns.value.map((c) => ({
    label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
    value: c.id,
  })),
);
const filterValue = computed({
  get: () =>
    String(api.value?.getColumn(filterColumn.value)?.getFilterValue() ?? ""),
  set: (value) =>
    api.value
      ?.getColumn(filterColumn.value)
      ?.setFilterValue(value || undefined),
});
watch(
  [search, filters],
  () => {
    selection.value = {};
    pagination.value.pageIndex = 0;
  },
  { deep: true },
);
watch(count, () => {
  const last = Math.max(
    0,
    Math.ceil(count.value / pagination.value.pageSize) - 1,
  );
  if (pagination.value.pageIndex > last) pagination.value.pageIndex = last;
});
function clear() {
  search.value = "";
  filters.value = [];
  filterColumn.value = "";
}
async function bulk(action: (items: T[]) => unknown) {
  await action(selected.value.map((r) => r.original));
  selection.value = {};
  await restoreFocus();
}
function exportRows(onlySelected = false) {
  const exported = onlySelected
    ? selected.value
    : (api.value?.getSortedRowModel().rows ?? []);
  const columns = dataColumns.value.filter((c) => c.getIsVisible());
  downloadCsv(
    props.filename,
    columns.map((c) =>
      typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
    ),
    exported.map((r) => columns.map((c) => r.getValue(c.id))),
  );
}
function identity(row: Row<T>) {
  return props.title(row.original);
}
// A resolved empty collection offers creation; a filtered-out one offers recovery.
// `empty` is resolved below rather than forwarded, so the wrapper keeps its
// no-records / no-matches contract while hosts may still override the slot.
// Cards are a presentation of the same row model, not a second collection:
// search, sorting, selection, pagination and export apply to both views.
const cards = computed(() => props.view === "cards");
const presentation = computed(() => ({
  table: cards.value ? "hidden" : "hidden md:block",
  controls: cards.value ? "flex" : "flex md:hidden",
  frame: cards.value ? "min-w-0" : "overflow-hidden rounded-lg bg-default md:border md:border-default",
  list: cards.value
    ? "grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-start"
    : "space-y-3 md:hidden",
  span: cards.value ? "md:col-span-2 2xl:col-span-3" : "",
}));
const forwardedSlots = computed(() => Object.keys(slots).filter((name) => name !== "empty"));
const empty = computed(() =>
  props.data.length
    ? {
        icon: "i-lucide-search-x",
        title: "No matches",
        description: "No records match the current search or filters.",
        actions: [{ label: "Clear filters", color: "neutral" as const, variant: "outline" as const, onClick: clear }],
      }
    : {
        icon: props.emptyIcon ?? "i-lucide-inbox",
        title: props.emptyTitle ?? "No records yet",
        description: props.emptyDescription,
        actions: props.emptyActions ?? [],
      },
);
defineExpose({ tableApi: api, clear });
</script>
<template>
  <div class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search records…"
        aria-label="Search records"
        class="min-w-40 flex-1 sm:w-64 sm:flex-none"
      />
      <div class="hidden flex-wrap items-center gap-2 md:flex">
        <USelect
          v-model="filterColumn"
          :items="columnOptions"
          placeholder="Filter column"
          aria-label="Filter column"
          class="w-36"
        />
        <UInput
          v-if="filterColumn"
          v-model="filterValue"
          placeholder="Filter value…"
          aria-label="Filter value"
          class="w-36"
        />
      </div>
      <UButton
        v-if="search || filters.length"
        icon="i-lucide-filter-x"
        aria-label="Clear filters"
        color="neutral"
        variant="ghost"
        @click="clear"
      />
      <USlideover
        v-model:open="filtersOpen"
        title="Filters"
        description="Filter the current records by one column."
      >
        <UButton
          class="md:hidden"
          icon="i-lucide-filter"
          :label="filters.length ? 'Filters · ' + filters.length : 'Filters'"
          :aria-label="
            filters.length
              ? 'Filters, ' + filters.length + ' active'
              : 'Filters'
          "
          color="neutral"
          variant="outline"
        />
        <template #body>
          <div class="space-y-3">
            <UFormField label="Column" name="filter-column">
              <USelect
                v-model="filterColumn"
                :items="columnOptions"
                placeholder="Filter column"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="filterColumn"
              label="Value"
              name="filter-value"
            >
              <UInput
                v-model="filterValue"
                placeholder="Filter value…"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-muted" role="status">
              {{ count }} of {{ data.length }} records match
            </p>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full items-center justify-between">
            <UButton
              label="Clear filters"
              color="neutral"
              variant="ghost"
              :disabled="!search && !filters.length"
              @click="clear"
            />
            <UButton
              label="Done"
              color="neutral"
              variant="outline"
              @click="filtersOpen = false"
            />
          </div>
        </template>
      </USlideover>
      <div class="ml-auto flex gap-2">
        <UDropdownMenu
          :items="
            dataColumns
              .filter((c) => c.getCanHide())
              .map((c) => ({
                label: String(c.columnDef.header || c.id),
                type: 'checkbox' as const,
                checked: c.getIsVisible(),
                onUpdateChecked: (value: boolean) => c.toggleVisibility(value),
                onSelect: (event: Event) => event.preventDefault(),
              }))
          "
        >
          <UTooltip text="Show or hide columns"><UButton
            icon="i-lucide-columns-3"
            aria-label="Show or hide columns"
            color="neutral"
            variant="outline"
          /></UTooltip>
        </UDropdownMenu>
        <UDropdownMenu
          :items="[
            {
              label: 'Export filtered rows',
              icon: 'i-lucide-download',
              onSelect: () => exportRows(),
            },
            {
              label: 'Export selected rows',
              disabled: !selected.length,
              onSelect: () => exportRows(true),
            },
          ]"
        >
          <UTooltip text="Export CSV"><UButton
            icon="i-lucide-download"
            aria-label="Export CSV"
            color="neutral"
            variant="outline"
          /></UTooltip>
        </UDropdownMenu>
      </div>
    </div>
    <div
      v-if="selected.length"
      class="flex items-center gap-2 rounded-lg bg-elevated p-2"
      role="status"
    >
      <span class="mr-auto text-sm font-medium"
        >{{ selected.length }} selected</span
      >
      <UButton
        v-if="archive"
        icon="i-lucide-archive"
        label="Archive"
        color="neutral"
        variant="ghost"
        @click="bulk(archive!)"
      />
      <UButton
        v-if="remove"
        icon="i-lucide-trash-2"
        label="Delete"
        color="error"
        variant="ghost"
        @click="bulkError = ''; bulkOpen = true"
      />
      <UButton
        icon="i-lucide-x"
        aria-label="Clear selection"
        color="neutral"
        variant="ghost"
        @click="selection = {}"
      />
    </div>
    <UModal
v-model:open="bulkOpen"
:title="'Delete ' + selected.length + ' records?'"
:dismissible="!bulkPending"
:content="{ onOpenAutoFocus: focusBulkCancel }"
:close="!bulkPending">
      <template #body><p class="text-sm text-muted">{{ deleteDescription || 'Delete the selected records?' }}</p><UAlert
v-if="bulkError"
class="mt-3"
:title="bulkError"
color="error"
variant="subtle"
role="alert" /></template>
      <template #footer><div class="ml-auto flex gap-2"><UButton
ref="bulkCancel"
label="Cancel"
color="neutral"
variant="outline"
:disabled="bulkPending"
@click="bulkOpen = false" /><UButton
label="Delete"
color="error"
:loading="bulkPending"
@click="deleteSelected" /></div></template>
    </UModal>
    <div class="items-center gap-3" :class="presentation.controls">
      <UCheckbox
        :model-value="api?.getIsAllPageRowsSelected() || false"
        aria-label="Select current page"
        @update:model-value="api?.toggleAllPageRowsSelected($event === true)"
      />
      <USelect
        :model-value="sorting[0]?.id"
        :items="columnOptions"
        placeholder="Sort by"
        aria-label="Sort by"
        @update:model-value="
          sorting = $event ? [{ id: $event, desc: false }] : []
        "
      />
      <UButton
        :icon="sorting[0]?.desc ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
        aria-label="Reverse sort order"
        color="neutral"
        variant="ghost"
        :disabled="!sorting.length"
        @click="sorting[0] && (sorting[0].desc = !sorting[0].desc)"
      />
    </div>
    <div :class="presentation.frame">
      <UTable
        ref="table"
        v-model:global-filter="search"
        v-model:sorting="sorting"
        v-model:column-filters="filters"
        v-model:column-visibility="visibility"
        v-model:row-selection="selection"
        v-model:expanded="expanded"
        v-model:pagination="pagination"
        :data="data"
        :columns="columnsWithControls"
        :on-select="rowClickable && to ? openRow : undefined"
        :loading="loading"
        :get-row-id="(row) => row.id"
        :expanded-options="{ getRowCanExpand: () => !!slots.expanded }"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel(),
          autoResetPageIndex: false,
        }"
        :class="presentation.table"
        sticky
      >
        <template #selection-header>
          <UCheckbox
            :model-value="
              api?.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : api?.getIsAllPageRowsSelected() || false
            "
            aria-label="Select current page"
            @update:model-value="
              api?.toggleAllPageRowsSelected($event === true)
            "
          />
        </template>
        <template #selection-cell="{ row }">
          <UCheckbox
            :model-value="row.getIsSelected()"
            :aria-label="'Select ' + identity(row)"
            @update:model-value="row.toggleSelected($event === true)"
          />
        </template>
        <template #expansion-cell="{ row }">
          <UTooltip :text="row.getIsExpanded() ? 'Collapse details' : 'Expand details'"><UButton
            :icon="
              row.getIsExpanded()
                ? 'i-lucide-chevron-down'
                : 'i-lucide-chevron-right'
            "
            :aria-label="
              (row.getIsExpanded() ? 'Collapse ' : 'Expand ') + identity(row)
            "
            :aria-expanded="row.getIsExpanded()"
            color="neutral"
            variant="ghost"
            @click="row.toggleExpanded()"
          /></UTooltip>
        </template>
        <template
          v-for="column in dataColumns.filter(c => typeof c.columnDef.header === 'string')"
          :key="column.id"
          #[`${column.id}-header`]="{ column: col }"
        >
          <UButton
            :label="String(column.columnDef.header || column.id)"
            :icon="
              col.getIsSorted()
                ? col.getIsSorted() === 'asc'
                  ? 'i-lucide-arrow-up'
                  : 'i-lucide-arrow-down'
                : undefined
            "
            color="neutral"
            variant="ghost"
            :class="numeric(col.id) ? 'w-full justify-end' : '-ml-1.5'"
            :disabled="!col.getCanSort()"
            @click="col.toggleSorting(col.getIsSorted() === 'asc')"
          />
        </template>
        <template
v-for="name in forwardedSlots"
:key="name"
#[name]="scope"
          ><slot
:name="name"
v-bind="scope"
        /></template>
        <template #empty>
          <slot
name="empty"
v-bind="empty"
:filtered="!!data.length"
:clear="clear"
            ><UEmpty v-bind="empty"
          /></slot>
        </template>
      </UTable>
      <div :class="presentation.list">
        <template v-if="loading">
          <USkeleton
v-for="n in 3"
:key="n"
class="h-20 w-full" />
        </template>
        <template v-else>
          <ListItem
            v-for="row in rows"
            :key="row.id"
            variant="card"
            :title="identity(row)"
            :to="to?.(row.original)"
            :row-clickable="rowClickable"
            :description="slots.expanded ? undefined : description?.(row.original)"
            selectable
            :expandable="!!slots.expanded"
            :selected="row.getIsSelected()"
            :expanded="row.getIsExpanded()"
            @update:selected="row.toggleSelected($event)"
            @update:expanded="row.toggleExpanded($event)"
          >
            <template
v-if="slots['card-leading']"
#leading
              ><slot
name="card-leading"
:row="row"
            /></template>
            <template #metadata
              ><slot
name="card-metadata"
:row="row"
:visible-columns="dataColumns.filter(c => c.getIsVisible()).map(c => c.id)"
            /></template>
            <template #actions
              ><slot
name="actions-cell"
:row="row"
            /></template>
            <template #expanded><slot name="expanded" :row="row" /></template>
          </ListItem>
          <slot
v-if="!rows.length"
name="empty"
v-bind="empty"
:filtered="!!data.length"
:clear="clear"
            ><UEmpty
v-bind="empty"
:class="presentation.span"
          /></slot>
        </template>
      </div>
    </div>
    <div
      class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"
    >
      <span
        >{{ count ? pagination.pageIndex * pagination.pageSize + 1 : 0 }}–{{ Math.min((pagination.pageIndex + 1) * pagination.pageSize, count) }} of {{ count }}<span v-if="selected.length">
          · {{ selected.length }} selected</span
        ></span
      >
      <div class="flex items-center gap-3">
        <USelect
          v-model="pagination.pageSize"
          :items="[10, 25, 50]"
          aria-label="Rows per page"
          size="sm"
          @update:model-value="pagination.pageIndex = 0"
        />
        <UPagination
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="count"
          :sibling-count="1"
          size="sm"
          @update:page="pagination.pageIndex = $event - 1"
        />
      </div>
    </div>
  </div>
</template>
