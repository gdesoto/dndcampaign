export type UiRefreshDocEntry = {
  slug: string
  title: string
  description: string
  body: string[]
}

const docsEntries: UiRefreshDocEntry[] = [
  {
    slug: 'introduction',
    title: 'UI Refresh Docs Overview',
    description: 'Reference pages used to validate docs layout behavior in UIR-2.',
    body: [
      'These docs routes are implementation examples for the UIR-2 layout milestone.',
      'They validate left-nav ownership by the docs layout and right-rail ownership by per-page templates.',
    ],
  },
  {
    slug: 'theme-foundation',
    title: 'Theme Foundation',
    description: 'Summary of the v2 token strategy used by the app shell and component overrides.',
    body: [
      'Theme tokens are defined in app/assets/css/main.css and consumed through semantic --ui-* variables.',
      'Global component defaults are configured in app/app.config.ts using token-driven classes.',
    ],
  },
  {
    slug: 'layout-architecture',
    title: 'Layout Architecture',
    description: 'Guidance for choosing default, docs, auth, and dashboard layout roles.',
    body: [
      'The default layout owns shared chrome for non-campaign routes.',
      'The docs layout owns left navigation; detail pages can provide a right aside panel.',
    ],
  },
]

export const useUiRefreshDocs = () => {
  const navigationItems = [
    { label: 'Overview', to: '/docs', icon: 'i-lucide-book-open' },
    ...docsEntries.map((entry) => ({
      label: entry.title,
      to: `/docs/${entry.slug}`,
      icon: 'i-lucide-scroll-text',
    })),
  ]

  const getEntryBySlug = (slug: string | null | undefined) => {
    if (!slug || slug === 'index') return docsEntries[0]
    return docsEntries.find((entry) => entry.slug === slug) || null
  }

  return {
    docsEntries,
    navigationItems,
    getEntryBySlug,
  }
}
