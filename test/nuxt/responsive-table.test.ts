import { expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ResponsiveTable from '../../app/components/shared/ResponsiveTable.vue'

it('keeps mobile identity, status, details, and actions on the native sorted and visible row model', async () => {
  const edit = vi.fn()
  const wrapper = await mountSuspended(ResponsiveTable, {
    props: {
      identityColumn: 'name', statusColumn: 'status',
      data: [{ name: 'Beta', status: 'Active', count: 2 }, { name: 'Alpha', status: 'Archived', count: 1 }],
      columns: [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'count', header: 'Count' }, { id: 'actions', header: 'Actions' }],
    },
    slots: { 'actions-cell': ({ row }: any) => h('button', { onClick: () => edit(row.original.name) }, 'Edit') },
  })
  await flushPromises()
  const table = wrapper.findComponent({ name: 'UTable' }).vm as unknown as { tableApi: any }
  table.tableApi.setSorting([{ id: 'name', desc: false }])
  await flushPromises()
  const records = wrapper.findAll('[data-mobile-record]')
  expect(records.map(record => record.get('[data-record-identity]').text())).toEqual(['Alpha', 'Beta'])
  expect(records[0]!.get('[data-record-status]').text()).toBe('Archived')
  expect(records[0]!.findAll('dt').map(label => label.text())).toEqual(['Count'])
  await records[0]!.get('[data-record-actions] button').trigger('click')
  expect(edit).toHaveBeenCalledWith('Alpha')
  table.tableApi.getColumn('count').toggleVisibility(false)
  await flushPromises()
  expect(wrapper.findAll('[data-mobile-record] dt')).toHaveLength(0)
  await wrapper.setProps({ loading: true })
  expect(wrapper.findAll('[data-mobile-record]')).toHaveLength(2)
  expect(wrapper.text()).toContain('Loading results')
  wrapper.unmount()
})
