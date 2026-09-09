<script setup lang="ts" generic="T extends Record<string, any>">
import type { TableColumn, TableRow } from '@nuxt/ui'

withDefaults(defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty?: string
}>(), { loading: false, empty: 'No results.' })

const table = useTemplateRef<{ tableApi: { getRowModel: () => { rows: TableRow<T>[] } } }>('table')
const rows = computed<TableRow<T>[]>(() => table.value?.tableApi.getRowModel().rows || [])
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
      <div v-for="row in rows" :key="row.id" class="space-y-2 border-b border-default py-3">
        <div v-for="(cell, index) in row.getVisibleCells()" :key="cell.id" class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
          <span class="text-muted">{{ typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : cell.column.id }}</span>
          <div :class="[index === 0 ? 'font-semibold' : '', 'min-w-0 break-words']">
            <slot :name="`${cell.column.id}-cell`" :row="row" :cell="cell">
              {{ cell.renderValue() }}
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
