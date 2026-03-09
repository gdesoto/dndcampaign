export type UiRefreshDocEntry = {
  slug: string
  title: string
  description: string
  body: string[]
}

const uxStyleGuideEntries: UiRefreshDocEntry[] = [
  {
    slug: 'ux-style-guide',
    title: 'UX Style Guide Overview',
    description: 'A multi-page UX guide for campaign dashboards, prep boards, character tools, and readable D&D interfaces.',
    body: [
      'This guide now lives as a docs section with focused pages for philosophy, layouts, components, interaction, and readability.',
      'Use it as the design reference for building game-facing interfaces with the app’s Nuxt UI conventions.',
    ],
  },
  {
    slug: 'ux-style-guide/philosophy',
    title: 'UX Guide: Philosophy',
    description: 'Core campaign UX principles grounded in usability heuristics and RPG mental models.',
    body: [
      'Covers visibility, real-world language, affordances, feedback, progressive disclosure, and hierarchy.',
      'Includes a campaign-facing demonstration of those principles working together in one screen.',
    ],
  },
  {
    slug: 'ux-style-guide/layouts',
    title: 'UX Guide: Layouts',
    description: 'How dashboards, campaign routes, scene boards, and character pages should be structured.',
    body: [
      'Shows route-level composition for dashboard, campaign, and character experiences.',
      'Includes creative scene-prep examples like ritual clocks and cinematic session boards.',
    ],
  },
  {
    slug: 'ux-style-guide/components',
    title: 'UX Guide: Components',
    description: 'Practical Nuxt UI component patterns for cards, tabs, modals, tables, and action controls.',
    body: [
      'Demonstrates concrete D&D-facing uses of Nuxt UI building blocks.',
      'Focuses on reusable component behavior rather than route composition.',
    ],
  },
  {
    slug: 'ux-style-guide/interaction',
    title: 'UX Guide: Interaction',
    description: 'Guidance for hover, click, focus, shortcuts, row actions, and in-context feedback.',
    body: [
      'Explains how live-play interaction should behave under time pressure.',
      'Includes demonstrations for scoped row actions and feedback states.',
    ],
  },
  {
    slug: 'ux-style-guide/readability',
    title: 'UX Guide: Readability',
    description: 'Screen real estate, right-rail usage, maps, notes, and dense interface readability.',
    body: [
      'Shows how to keep campaign information dense but readable.',
      'Includes practical map and player-note examples for the D&D tracker.',
    ],
  },
  {
    slug: 'ux-style-guide/dnd-components',
    title: 'UX Guide: D&D Components',
    description: 'Character cards, quest logs, initiative trackers, faction displays, and other D&D-specific shared components.',
    body: [
      'Showcases purpose-built component patterns for the D&D domain.',
      'Covers character cards, party strips, quest logs, initiative trackers, threat clocks, loot cards, and location displays.',
    ],
  },
]

const referenceEntries: UiRefreshDocEntry[] = [
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
  const route = useRoute()
  const docsEntries = [...uxStyleGuideEntries, ...referenceEntries]
  const isUxStyleGuideRoute = computed(() => route.path.startsWith('/docs/ux-style-guide'))
  const navigationItems = computed(() => [
    [
      { label: 'Navigation', type: 'label' as const },
      { label: 'Overview', to: '/docs', icon: 'i-lucide-book-open' },
      { label: 'API Reference', to: '/docs/api', icon: 'i-lucide-braces' },
    ],
    [
      { label: 'Style Guide', type: 'label' as const },
      {
        label: 'UX Style Guide',
        to: '/docs/ux-style-guide',
        icon: 'i-lucide-scroll-text',
        active: isUxStyleGuideRoute.value,
        defaultOpen: isUxStyleGuideRoute.value,
        children: uxStyleGuideEntries.map((entry) => ({
          label: entry.slug === 'ux-style-guide' ? 'Overview' : entry.title.replace('UX Guide: ', ''),
          to: `/docs/${entry.slug}`,
          description: entry.description,
        })),
      },
    ],
    [
      { label: 'Reference', type: 'label' as const },
      ...referenceEntries.map((entry) => ({
        label: entry.title,
        to: `/docs/${entry.slug}`,
        icon: 'i-lucide-library-big',
      })),
    ],
  ])

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
