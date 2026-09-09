<script setup lang="ts" generic="T extends Record<string, any>">
import type { TableColumn, TableRow } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty?: string
  identityColumn?: string
  statusColumn?: string
  actionColumn?: string
}>(), { loading: false, empty: 'No results.', identityColumn: undefined, statusColumn: undefined, actionColumn: 'actions' })

const table = useTemplateRef<{ tableApi: { getRowModel: () => { rows: TableRow<T>[] } } }>('table')
const rows = computed<TableRow<T>[]>(() => table.value?.tableApi.getRowModel().rows || [])
const mobileRows = computed(() => rows.value.map(row => {
  const cells = row.getVisibleCells()
  const identity = cells.find(cell => cell.column.id === props.identityColumn)
    || cells.find(cell => cell.column.id !== props.actionColumn && cell.column.id !== props.statusColumn)
  const status = cells.find(cell => cell.column.id === props.statusColumn && cell !== identity)
  const actions = cells.find(cell => cell.column.id === props.actionColumn && cell !== identity && cell !== status)
  return { row, identity, status, actions, details: cells.filter(cell => cell !== identity && cell !== status && cell !== actions) }
}))
</script>

<template>
  <div :aria-busy="loading">
    <UTable ref="table" :data="data" :columns="columns" :loading="loading" :empty="empty" class="hidden md:block">
      <template v-for="(_, name) in $slots" #[name]="scope">
        <slot :name="name" v-bind="scope" />
      </template>
    </UTable>
    <div class="space-y-3 md:hidden">
      <p v-if="loading" role="status" class="text-sm text-muted">Loading results…</p>
      <p v-else-if="!data.length" class="text-sm text-muted">{{ empty }}</p>
      <article v-for="item in mobileRows" :key="item.row.id" class="space-y-3 border-b border-default py-3" data-mobile-record>
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 flex-1 basis-40 space-y-1">
            <div v-if="item.identity" class="break-words text-sm font-semibold" data-record-identity>
              <slot :name="`${item.identity.column.id}-cell`" :row="item.row" :cell="item.identity">{{ item.identity.renderValue() }}</slot>
            </div>
            <div v-if="item.status" class="text-sm" data-record-status>
              <slot :name="`${item.status.column.id}-cell`" :row="item.row" :cell="item.status">{{ item.status.renderValue() }}</slot>
            </div>
          </div>
          <div v-if="item.actions" class="ml-auto max-w-full shrink-0" data-record-actions>
            <slot :name="`${item.actions.column.id}-cell`" :row="item.row" :cell="item.actions">{{ item.actions.renderValue() }}</slot>
          </div>
        </div>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm min-[360px]:grid-cols-2">
          <div v-for="cell in item.details" :key="cell.id" class="min-w-0">
            <dt class="text-muted">{{ typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : cell.column.id }}</dt>
            <dd class="break-words">
              <slot :name="`${cell.column.id}-cell`" :row="item.row" :cell="cell">{{ cell.renderValue() }}</slot>
            </dd>
          </div>
        </dl>
      </article>
    </div>
  </div>
</template>
