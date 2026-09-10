import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDC } from '#components'

describe('campaign Markdown rendering', () => {
  it('renders headings, GFM tables, task lists, links, and fenced code with the configured plugins', async () => {
    const wrapper = await mountSuspended(MDC, {
      props: {
        tag: 'article',
        value: [
          '## Field notes',
          '',
          '**Clue:** ~~lost~~ recovered. [Journal](/campaigns)',
          '',
          '| Place | Status |',
          '| --- | --- |',
          '| Watchtower | Explored |',
          '',
          '- [x] Find the key',
          '- [ ] Open the vault',
          '',
          '```js',
          'const clue = "silver"',
          '```',
        ].join('\n'),
      },
    })

    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.get('h2').text()).toContain('Field notes')
    expect(wrapper.get('strong').text()).toBe('Clue:')
    expect(wrapper.get('del').text()).toBe('lost')
    expect(wrapper.get('a[href="/campaigns"]').text()).toBe('Journal')
    expect(wrapper.findAll('th').map(cell => cell.text())).toEqual(['Place', 'Status'])
    expect(wrapper.findAll('td').map(cell => cell.text())).toEqual(['Watchtower', 'Explored'])
    const tasks = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(tasks).toHaveLength(2)
    expect(tasks.map(task => task.element.checked)).toEqual([true, false])
    expect(tasks.every(task => task.element.disabled)).toBe(true)
    expect(wrapper.get('pre code').text()).toContain('const clue = "silver"')
    wrapper.unmount()
  })

  it('updates an editor preview and restores previously rendered content', async () => {
    const first = '## First draft\n\nThe door is closed.'
    const second = '## Second draft\n\nThe door is open.'
    const wrapper = await mountSuspended(MDC, { props: { value: first, tag: 'article' } })

    await wrapper.setProps({ value: second })
    await vi.waitFor(() => {
      expect(wrapper.get('h2').text()).toContain('Second draft')
      expect(wrapper.text()).toContain('The door is open.')
      expect(wrapper.text()).not.toContain('The door is closed.')
    })
    await wrapper.setProps({ value: first })
    await vi.waitFor(() => {
      expect(wrapper.get('h2').text()).toContain('First draft')
      expect(wrapper.text()).toContain('The door is closed.')
      expect(wrapper.text()).not.toContain('The door is open.')
    })
    wrapper.unmount()
  })

  it('removes executable markup and unsafe attributes from journal content', async () => {
    const wrapper = await mountSuspended(MDC, {
      props: {
        tag: 'article',
        value: [
          'Safe journal text.',
          '',
          '<script>alert("mdc-test")</script>',
          '<a href="javascript:alert(1)" onclick="alert(1)" v-on:click="alert(1)">Unsafe link</a>',
          '<div v-html="dangerousHtml">Visible note</div>',
        ].join('\n'),
      },
    })

    expect(wrapper.text()).toContain('Safe journal text.')
    expect(wrapper.find('script').exists()).toBe(false)
    for (const element of wrapper.findAll('*')) {
      for (const [name, value] of Object.entries(element.attributes())) {
        expect(name).not.toMatch(/^(?:on|v-|:|@)/i)
        if (name === 'href') expect(value).not.toMatch(/^javascript:/i)
      }
    }
    wrapper.unmount()
  })
})
