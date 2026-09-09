/**
 * Three identities over one application. Each is configuration only — no page,
 * component, verb, confirmation, or focus behavior changes between them, which
 * is the claim section 9 of the guidelines makes and this file has to keep.
 *
 * An identity is assembled from the three layers the guide names, in order:
 *   colors    → `ui.colors` aliases, applied at runtime through updateAppConfig
 *   className → CSS tokens (`--ui-radius`, typefaces, type scale, page padding)
 *   ui/props  → shared component defaults, applied through the native UTheme
 * The `css` and `config` strings are the same values as copyable source for the
 * gallery, so the page cannot document an identity the app is not running.
 */
export interface Identity {
  id: string;
  label: string;
  description: string;
  icon: string;
  className: string;
  colors: { primary: string; neutral: string };
  ui: Record<string, Record<string, string>>;
  props: Record<string, Record<string, unknown>>;
  css: string;
  config: string;
  theme: string;
}

export const identities: Identity[] = [
  {
    id: "reference",
    label: "Fieldwork reference",
    description:
      "The baseline this guide is written against: blue and slate, Public Sans with JetBrains Mono, compact radii, restrained borders. Nothing is layered on top of app.config.ts.",
    icon: "i-lucide-square-dashed",
    className: "identity-reference",
    colors: { primary: "blue", neutral: "slate" },
    ui: {},
    props: {},
    css: `/* app/assets/css/main.css — the defaults, no identity class needed */\n@theme static {\n  --font-sans: 'Public Sans', ui-sans-serif, system-ui, sans-serif;\n  --font-mono: 'JetBrains Mono', ui-monospace, monospace;\n  --font-display: var(--font-sans);\n  --text-page-title: 1.25rem;\n  --spacing-page: 1.25rem;\n}\n:root { --ui-radius: 0.25rem; }`,
    config: `ui: {\n  colors: { primary: 'blue', neutral: 'slate' },\n}`,
    theme: `<!-- No UTheme layer: this identity is the shared app.config baseline. -->`,
  },
  {
    id: "campaign",
    label: "Campaign tracker",
    description:
      "A tabletop campaign log: amber on stone, small caps for titles in Cinzel over Alegreya Sans, softer radii, a roomier page, and gold that catches the light as the cursor crosses a card. The same tables, the same verbs, the same confirmations.",
    icon: "i-lucide-dices",
    className: "identity-campaign",
    colors: { primary: "amber", neutral: "stone" },
    ui: {
      card: { root: "ring-1 ring-primary/25 identity-sheen", header: "bg-primary/5" },
      badge: { base: "uppercase tracking-[0.08em]" },
      table: { th: "uppercase tracking-[0.08em] bg-primary/5" },
    },
    props: { badge: { variant: "subtle" } },
    css: `/* app/assets/css/main.css */\n.identity-campaign {\n  --font-sans: var(--font-alegreya-sans);\n  --font-display: var(--font-cinzel);\n  --text-page-title: 1.5rem;\n  --text-metric: 1.75rem;\n  --spacing-page: 1.5rem;\n  --ui-radius: 0.625rem;\n}\n\n/* Character: a sweep on hover only, clear at both ends, off under\n   reduced motion. Carries no state, so it may sit on every card. */\n.identity-sheen::after {\n  background-image: linear-gradient(105deg, transparent 44%,\n    color-mix(in oklab, var(--ui-primary) 16%, transparent) 50%,\n    transparent 56%);\n  background-size: 260% 100%;\n  background-position: 130% 0;\n  transition: background-position 700ms ease-out;\n}\n.identity-sheen:hover::after { background-position: -30% 0; }`,
    config: `ui: {\n  colors: { primary: 'amber', neutral: 'stone' },\n}`,
    theme: `<UTheme\n  :ui="{\n    card: { root: 'ring-1 ring-primary/25 identity-sheen', header: 'bg-primary/5' },\n    badge: { base: 'uppercase tracking-[0.08em]' },\n    table: { th: 'uppercase tracking-[0.08em] bg-primary/5' },\n  }"\n  :props="{ badge: { variant: 'subtle' } }"\n/>`,
  },
  {
    id: "coastal",
    label: "Coastal rentals",
    description:
      "A holiday-let console: teal on zinc, Fraunces titles over Nunito, generous radii and comfortable rows. Density gives way to warmth without giving up a single scanning rule.",
    icon: "i-lucide-palmtree",
    className: "identity-coastal",
    colors: { primary: "teal", neutral: "zinc" },
    ui: {
      card: { root: "ring-0 shadow-sm bg-elevated/30" },
      table: { td: "h-11", th: "bg-elevated/60" },
      button: { base: "font-semibold" },
    },
    props: { badge: { variant: "soft" } },
    css: `/* app/assets/css/main.css */\n.identity-coastal {\n  --font-sans: var(--font-nunito);\n  --font-display: var(--font-fraunces);\n  --text-page-title: 1.375rem;\n  --spacing-page: 1.5rem;\n  --ui-radius: 0.875rem;\n}`,
    config: `ui: {\n  colors: { primary: 'teal', neutral: 'zinc' },\n}`,
    theme: `<UTheme\n  :ui="{\n    card: { root: 'ring-0 shadow-sm bg-elevated/30' },\n    table: { td: 'h-11', th: 'bg-elevated/60' },\n    button: { base: 'font-semibold' },\n  }"\n  :props="{ badge: { variant: 'soft' } }"\n/>`,
  },
];
