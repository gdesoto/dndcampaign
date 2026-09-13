# The DM Vault — Complete Style Guide
### Nuxt UI v4 · Components, Theming, Layouts & Navigation

> `@nuxt/ui ^4.0` · `Tailwind CSS v4` · `Cinzel + Crimson Pro` · Light & Dark Mode

A complete reference for building The DM Vault with Nuxt UI v4 — covering the dual-mode colour system, CSS token overrides, global `app.config.ts` slot overrides, per-component usage patterns, layout architecture, and navigation.

---

## Table of Contents

**Setup**
1. [File Overview](#1-file-overview)
2. [Colour System & Design Philosophy](#2-colour-system--design-philosophy)
3. [CSS Tokens — `assets/css/main.css`](#3-css-tokens--assetscssmaincss)
4. [Global Overrides — `app.config.ts`](#4-global-overrides--appconfigts)
5. [Module Setup — `nuxt.config.ts`](#5-module-setup--nuxtconfigts)
6. [Color Mode Toggle](#6-color-mode-toggle)

**Components**
7. [UButton](#7-ubutton)
8. [UBadge](#8-ubadge)
9. [UCard](#9-ucard)
10. [UTabs](#10-utabs)
11. [UInput & UTextarea](#11-uinput--utextarea)
12. [UAvatar](#12-uavatar)
13. [UProgress](#13-uprogress)
14. [UAlert](#14-ualert)
15. [UTable](#15-utable)
16. [UTooltip](#16-utooltip)
17. [UKbd](#17-ukbd)
18. [USeparator](#18-useparator)
19. [The `:ui` Prop — Per-Instance Overrides](#19-the-ui-prop--per-instance-overrides)

**Layouts & Navigation**
20. [Layout Architecture Overview](#20-layout-architecture-overview)
21. [The Global Shell — `app.vue`](#21-the-global-shell--appvue)
22. [Layout Types](#22-layout-types)
23. [Nested Page Structures](#23-nested-page-structures)
24. [Navigation Patterns](#24-navigation-patterns)
25. [Programmatic Navigation](#25-programmatic-navigation)

**Reference**
26. [Layout Decision Guide](#26-layout-decision-guide)
27. [File Structure Reference](#27-file-structure-reference)
28. [Variants Quick Reference](#28-variants-quick-reference)
29. [DM Vault Specific Rules](#29-dmvault-specific-rules)

---

## 1. File Overview

Four files power the entire theme:

```
assets/css/main.css   ← CSS tokens, @theme, font imports, light/dark --ui-* overrides
app.config.ts         ← global component slot / variant overrides (mode-agnostic)
nuxt.config.ts        ← module registration, color aliases, colorMode config
app.vue               ← minimal UApp shell — UMain + NuxtLayout only, no header/footer
components/
  AppHeader.vue       ← shared header component used by layouts that need it
  AppFooter.vue       ← shared footer component used by layouts that need it
```

---

## 2. Colour System & Design Philosophy

The DM Vault runs two modes — **dark** (the default campaign experience) and **light** (a daylight reading mode). Both share the same medieval manuscript soul: neither is stark white or pure black. The design intent at every layer is *aged material*, not a screen.

### Dark mode — Candlelit Vellum

The original dark palette. Deep charcoal grounds (`#0e0c0a`), layered warm surfaces, a gold accent that reads as torch-lit metal, and parchment-coloured text. This is the primary mode for active sessions.

| Token | Value | Role |
|---|---|---|
| `--ui-bg` | `#0e0c0a` | Page background — near-black charcoal |
| `--ui-bg-elevated` | `#16130f` | Cards, panels — dark warm brown |
| `--ui-bg-accented` | `#1e1a14` | Inputs, hover fills |
| `--ui-bg-muted` | `#26211a` | Subtle fills, tooltips |
| `--ui-border` | `#3a3020` | Default borders — warm dark |
| `--ui-border-accented` | `#7a5c28` | Active/focus borders — gold-dim |
| `--ui-text` | `#e8dcc8` | Body text — aged parchment |
| `--ui-text-muted` | `#8a7a62` | Secondary text — faded ink |
| `--ui-text-dimmed` | `#5a4e3a` | Placeholder / disabled |
| `--ui-primary` | `#c9963a` | Gold — the brand accent |

### Light mode — Aged Parchment

Light mode does not go white. It uses warm off-whites and tan tones drawn from undyed linen, aged paper, and washed stone. The gold accent shifts to a richer, darker value that reads well against pale grounds. Dark ink replaces parchment text.

| Token | Value | Role |
|---|---|---|
| `--ui-bg` | `#f5efe4` | Page background — old paper |
| `--ui-bg-elevated` | `#ede4d4` | Cards, panels — warm cream |
| `--ui-bg-accented` | `#e0d4be` | Inputs, hover fills — linen |
| `--ui-bg-muted` | `#d4c8a8` | Subtle fills — tan |
| `--ui-border` | `#c0aa84` | Default borders — warm khaki |
| `--ui-border-accented` | `#a97a28` | Active/focus borders — darker gold |
| `--ui-text` | `#2a2018` | Body text — dark walnut ink |
| `--ui-text-muted` | `#6e5a3e` | Secondary text — sepia |
| `--ui-text-dimmed` | `#9e8a6a` | Placeholder / disabled |
| `--ui-primary` | `#a97a28` | Gold — darker to hold contrast on pale ground |

### Shared: Brand Gold Scale

The `--color-primary-*` scale is the same in both modes — all 11 shades span from near-white cream to deep molasses. What changes between modes is *which shade* the `--ui-primary` semantic token points to. Components that use `text-primary-500` always get gold; components that use `text-primary` get the mode-appropriate value.

### Shared: Status Colours

Status colours (error/success/info/warning) are intentionally the same hue in both modes but shift in lightness slightly so they maintain contrast against their respective backgrounds. They are defined once in `@theme` at the 500-level and adjusted with opacity utilities (`/12`, `/20`, `/35`) in component overrides — the same class reads correctly in both modes.

---

## 3. CSS Tokens — `assets/css/main.css`

This is the complete `main.css`. The structure is:

1. `@import` — load Tailwind v4 and Nuxt UI
2. `@import url(...)` — load fonts
3. `@theme {}` — register all Tailwind design tokens (same in both modes)
4. `:root {}` — set dark-mode `--ui-*` semantic tokens (default = dark)
5. `.light {}` — override `--ui-*` tokens for light mode

Nuxt UI's `colorMode` module adds a `.dark` or `.light` class to `<html>` depending on the user's active preference. Because the default `:root` is dark, the `.light` block only needs to override what changes.

```css
@import 'tailwindcss';
@import '@nuxt/ui';

/* ── DM Vault Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,500;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

/* ══════════════════════════════════════════════════════
   TAILWIND @THEME — shared tokens, both modes
   These register utility classes like bg-primary-500,
   text-neutral-400 etc. The values here are mode-agnostic;
   semantic meaning comes from the --ui-* variables below.
══════════════════════════════════════════════════════ */
@theme {
  /* Fonts */
  --font-sans:    'Crimson Pro', Georgia, serif;
  --font-display: 'Cinzel', serif;
  --font-mono:    'JetBrains Mono', monospace;

  /* ── Brand Gold — full 11-shade scale ── */
  /* All 11 shades are required: Nuxt UI generates component  */
  /* variant classes at build time using color-primary-{50..950}. */
  --color-primary-50:  #fdf6e3;
  --color-primary-100: #faeac0;
  --color-primary-200: #f5d68a;
  --color-primary-300: #eec05a;
  --color-primary-400: #e8b85a;  /* gold-light */
  --color-primary-500: #c9963a;  /* gold — dark mode ui-primary */
  --color-primary-600: #a97a28;  /* gold — light mode ui-primary */
  --color-primary-700: #7a5c28;  /* gold-dim */
  --color-primary-800: #5a3e18;
  --color-primary-900: #3a2a10;
  --color-primary-950: #1e1508;

  /* ── Neutral — parchment/ink scale ── */
  /* Dark mode reads 50 (bright) as text, 950 (dark) as bg.  */
  /* Light mode reads 950 (dark ink) as text, 50 (pale) as bg. */
  /* The same scale serves both; direction flips via --ui-* tokens. */
  --color-neutral-50:  #f5efe4;  /* light bg / dark text-highlight */
  --color-neutral-100: #ede4d4;
  --color-neutral-200: #e0d4be;
  --color-neutral-300: #d4c8a8;
  --color-neutral-400: #c0aa84;
  --color-neutral-500: #9e8a6a;
  --color-neutral-600: #6e5a3e;  /* light text-muted */
  --color-neutral-700: #4a3e2e;
  --color-neutral-800: #3a3020;  /* dark border */
  --color-neutral-900: #26211a;
  --color-neutral-950: #0e0c0a;  /* dark bg */

  /* ── Status colours ── */
  /* Defined at the 500 level; opacity modifiers handle */
  /* tinted backgrounds in both modes without duplication. */
  --color-error-400:   #e06050;
  --color-error-500:   #c44a3a;
  --color-error-600:   #a03020;
  --color-error-900:   #3a1008;

  --color-success-400: #5aaa6a;
  --color-success-500: #4a8a5a;
  --color-success-600: #3a6a44;

  --color-info-400:    #5a8abA;
  --color-info-500:    #3a6a9a;
  --color-info-600:    #2a5080;

  --color-warning-400: #e8b85a;
  --color-warning-500: #c9963a;
  --color-warning-600: #a97a28;
}

/* ══════════════════════════════════════════════════════
   :root — DARK MODE TOKENS (default)
   These --ui-* variables are consumed directly by every
   Nuxt UI component. Setting them here means dark mode
   requires no class prefix — it is the baseline.
══════════════════════════════════════════════════════ */
:root {
  /* Backgrounds — dark: charcoal to warm brown */
  --ui-bg:          #0e0c0a;
  --ui-bg-elevated: #16130f;
  --ui-bg-accented: #1e1a14;
  --ui-bg-muted:    #26211a;

  /* Borders — dark: warm dark to gold-dim */
  --ui-border:          #3a3020;
  --ui-border-accented: #7a5c28;
  --ui-border-muted:    #26211a;

  /* Text — dark: parchment to faded ink */
  --ui-text:             #e8dcc8;
  --ui-text-muted:       #8a7a62;
  --ui-text-dimmed:      #5a4e3a;
  --ui-text-highlighted: #f5efe4;

  /* Brand & radius */
  --ui-primary: var(--color-primary-500);  /* gold #c9963a */
  --ui-radius:  0.25rem;                   /* 4px — angular medieval feel */
}

/* ══════════════════════════════════════════════════════
   .light — LIGHT MODE TOKEN OVERRIDES
   Nuxt UI's colorMode adds class="light" to <html>.
   Only values that differ from :root need to appear here.
   Structure mirrors :root above; font and radius are
   inherited unchanged.
══════════════════════════════════════════════════════ */
.light {
  /* Backgrounds — light: aged paper to linen tan */
  --ui-bg:          #f5efe4;
  --ui-bg-elevated: #ede4d4;
  --ui-bg-accented: #e0d4be;
  --ui-bg-muted:    #d4c8a8;

  /* Borders — light: warm khaki to darker gold */
  --ui-border:          #c0aa84;
  --ui-border-accented: #a97a28;
  --ui-border-muted:    #d4c8a8;

  /* Text — light: dark walnut ink to sepia */
  --ui-text:             #2a2018;
  --ui-text-muted:       #6e5a3e;
  --ui-text-dimmed:      #9e8a6a;
  --ui-text-highlighted: #1a1410;

  /* Brand — light: darker gold for contrast on pale ground */
  --ui-primary: var(--color-primary-600);  /* #a97a28 */
}

/* ══════════════════════════════════════════════════════
   COMPONENT-SPECIFIC OVERRIDES
   These target elements not fully controlled by --ui-* vars.
   Use .dark / .light prefixes only when a component needs
   a value that cannot be derived from --ui-* tokens alone.
══════════════════════════════════════════════════════ */

/* ── Card gold shimmer — top-edge accent line ── */
/* The ::before pseudo fades in on hover. In dark mode it  */
/* is a gold gradient; in light mode it is a darker ink line. */
.dmvault-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--ui-border-accented), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}
.dmvault-card:hover::before { opacity: 1; }

/* ── Initiative pulse ring ── */
@keyframes pulse-ring {
  0%, 100% { box-shadow: inset 0 0 0 1px var(--ui-border-accented); opacity: 1; }
  50%       { box-shadow: inset 0 0 0 1px var(--ui-border-accented); opacity: 0.3; }
}
.animate-pulse-ring { animation: pulse-ring 2s ease infinite; }

/* ── Spell slot pip — filled state differs per mode ── */
.dark  .pip-filled { background: var(--color-primary-700); border-color: var(--color-primary-700); }
.light .pip-filled { background: var(--color-primary-600); border-color: var(--color-primary-500); }
```

---

## 4. Global Overrides — `app.config.ts`

This is the complete `app.config.ts`. Because component overrides use semantic `--ui-*` tokens rather than raw hex values or hardcoded Tailwind dark-shade classes, **every override in this file works in both light and dark mode without a single `dark:` prefix**.

The key principle: write slot classes against the `--ui-*` variable system (`bg-[var(--ui-bg-elevated)]`, `border-[var(--ui-border)]`, `text-[var(--ui-text-muted)]`) rather than concrete palette classes like `bg-neutral-900` or `text-neutral-50`. The mode switch then happens in `main.css` alone.

```ts
export default defineAppConfig({
  ui: {
    // ── Color aliases ──────────────────────────────────────────────
    // These tell Nuxt UI which Tailwind color scale maps to each
    // semantic role. The component system uses these names internally
    // to generate variant classes.
    colors: {
      primary: 'primary',  // gold scale — all 11 shades
      neutral: 'neutral',  // parchment/ink scale — direction flips per mode
      error:   'red',
      success: 'green',
      info:    'blue',
      warning: 'amber',
    },

    // ── UButton ───────────────────────────────────────────────────
    // All buttons use font-display (Cinzel) + uppercase.
    // Variant colours use primary/neutral/error semantic names, not
    // hardcoded shades, so they adapt to --ui-primary automatically.
    button: {
      slots: {
        base: 'font-display font-semibold tracking-widest uppercase transition-all cursor-pointer',
      },
      variants: {
        size: {
          sm: { base: 'text-[10px] px-2.5 py-1 gap-1.5 rounded' },
          md: { base: 'text-[11px] px-3 py-1.5 gap-1.5 rounded' },
          lg: { base: 'text-[13px] px-4 py-2 gap-2 rounded' },
        },
        variant: {
          // solid: filled gold CTA — uses primary-500 directly so it stays
          // vivid gold in both modes (primary-500 is #c9963a in both).
          solid: {
            base: 'bg-primary-500 text-neutral-950 border border-primary-400 hover:bg-primary-400',
          },
          // outline: tinted bg + border + text all use --ui-primary-aware
          // shades. Works in both modes because primary-700 is mid-gold,
          // primary-400 is lighter gold — readable against either bg.
          outline: {
            base: 'bg-primary-500/10 border border-primary-700 text-primary-600 hover:bg-primary-500/20 hover:border-primary-600 dark:text-primary-400 dark:border-primary-700',
          },
          // ghost: transparent fill; text and border use --ui-* text/border
          // so they automatically invert per mode.
          ghost: {
            base: 'bg-transparent border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:border-[var(--ui-border-accented)] hover:text-[var(--ui-text)]',
          },
          // soft: danger actions — error tint. The /15 opacity means the
          // same class produces the right visual weight on both bg colours.
          soft: {
            base: 'bg-error-500/15 border border-error-600/40 text-error-600 hover:bg-error-500/25 dark:text-error-400 dark:border-error-900',
          },
          // link: no chrome, just coloured text
          link: {
            base: 'bg-transparent border-transparent text-primary-700 hover:text-primary-500 p-0 dark:text-primary-600 dark:hover:text-primary-400',
          },
        },
      },
      defaultVariants: {
        size:    'md',
        color:   'primary',
        variant: 'outline',
      },
    },

    // ── UBadge ────────────────────────────────────────────────────
    badge: {
      slots: {
        base: 'font-display tracking-[0.08em] uppercase',
      },
      variants: {
        size: {
          sm: { base: 'text-[10px] px-1.5 py-0.5 rounded-[3px]' },
          md: { base: 'text-[10px] px-1.5 py-0.5 rounded-[3px]' },
        },
      },
      defaultVariants: {
        size:    'sm',
        color:   'primary',
        variant: 'outline',
      },
    },

    // ── UCard ─────────────────────────────────────────────────────
    // Uses --ui-* variable references so bg, border and hover states
    // all resolve from the mode's token set automatically.
    card: {
      slots: {
        root:   'bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] rounded-md overflow-hidden transition-colors hover:border-[var(--ui-border-accented)] relative group dmvault-card',
        header: 'px-4 py-2.5 border-b border-[var(--ui-border)] flex items-center justify-between',
        body:   'p-4',
        footer: 'px-4 py-2 border-t border-[var(--ui-border)] flex gap-2 justify-end',
      },
      defaultVariants: { variant: 'outline' },
    },

    // ── UTabs ─────────────────────────────────────────────────────
    // Tab bar bg and trigger colours use --ui-* tokens. The
    // data-[state=active] gold border and text use primary-500/600
    // (vivid gold readable on both bg colours at those shades).
    tabs: {
      slots: {
        root:      'flex flex-col',
        list:      'flex border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-6',
        trigger:   'font-display text-[11px] tracking-[0.1em] uppercase text-[var(--ui-text-dimmed)] px-3.5 py-2.5 border-b-2 border-transparent -mb-px transition-all cursor-pointer hover:text-[var(--ui-text-muted)] data-[state=active]:text-primary-500 data-[state=active]:border-primary-500',
        indicator: 'hidden',
        content:   'outline-none',
      },
    },

    // ── UInput ────────────────────────────────────────────────────
    input: {
      slots: {
        root: 'relative',
        base: 'w-full bg-[var(--ui-bg-accented)] border border-[var(--ui-border)] rounded font-sans text-[var(--ui-text)] placeholder:text-[var(--ui-text-dimmed)] placeholder:italic outline-none transition-all focus:border-[var(--ui-border-accented)] focus:ring-2 focus:ring-[var(--ui-border-accented)]/20',
      },
      variants: {
        size: {
          sm: { base: 'text-sm px-2.5 py-1.5' },
          md: { base: 'text-[14px] px-2.5 py-1.5' },
          lg: { base: 'text-base px-3 py-2' },
        },
      },
      defaultVariants: { size: 'md', color: 'neutral' },
    },

    // ── UTextarea ─────────────────────────────────────────────────
    textarea: {
      slots: {
        base: 'w-full bg-[var(--ui-bg-accented)] border border-[var(--ui-border)] rounded font-sans text-[var(--ui-text)] placeholder:text-[var(--ui-text-dimmed)] placeholder:italic outline-none transition-all focus:border-[var(--ui-border-accented)] resize-none leading-relaxed',
      },
    },

    // ── UAvatar ───────────────────────────────────────────────────
    avatar: {
      slots: {
        root:     'relative inline-flex shrink-0 rounded-full bg-[var(--ui-bg-muted)] border-2 border-[var(--ui-border)] transition-all hover:-translate-y-0.5 hover:border-[var(--ui-border-accented)] cursor-pointer overflow-hidden',
        image:    'object-cover',
        fallback: 'font-display text-[var(--ui-text-muted)]',
        chip:     'absolute border-2 border-[var(--ui-bg-elevated)] rounded-full',
      },
      variants: {
        size: {
          sm: { root: 'size-7 text-sm',   chip: 'size-2 bottom-0 right-0' },
          md: { root: 'size-10 text-lg',  chip: 'size-2.5 bottom-0 right-0' },
          lg: { root: 'size-14 text-2xl', chip: 'size-3 bottom-0.5 right-0.5' },
        },
      },
    },

    // ── UProgress ─────────────────────────────────────────────────
    // Track uses --ui-bg-muted; fills use semantic colour gradients.
    // The gradient shades (600→400, 700→500) are vivid enough to read
    // on both the dark track and the lighter light-mode track.
    progress: {
      slots: {
        root:      'w-full',
        track:     'bg-[var(--ui-bg-muted)] rounded-full overflow-hidden',
        indicator: 'rounded-full transition-all duration-500',
      },
      variants: {
        color: {
          primary: { indicator: 'bg-gradient-to-r from-primary-700 to-primary-500' },
          success: { indicator: 'bg-gradient-to-r from-success-600 to-success-400' },
          error:   { indicator: 'bg-gradient-to-r from-error-600 to-error-400' },
          warning: { indicator: 'bg-gradient-to-r from-warning-600 to-warning-400' },
        },
        size: {
          sm: { track: 'h-1.5' },
          md: { track: 'h-2' },
          lg: { track: 'h-3' },
        },
      },
      defaultVariants: { color: 'primary', size: 'md' },
    },

    // ── UAlert ────────────────────────────────────────────────────
    // Tinted bg uses /10–/15 opacity so it sits correctly on both
    // the dark and light --ui-bg. Border uses /30–/40 opacity.
    alert: {
      slots: {
        root:        'rounded-md p-3 border flex gap-2.5 items-start',
        title:       'font-display text-[11px] tracking-[0.08em] uppercase mb-1',
        description: 'font-sans text-[13px] italic',
        icon:        'size-4 shrink-0 mt-0.5',
      },
      variants: {
        color: {
          info:    { root: 'bg-info-500/10 border-info-500/30 text-info-600 dark:text-info-400' },
          success: { root: 'bg-success-500/10 border-success-500/30 text-success-600 dark:text-success-400' },
          warning: { root: 'bg-primary-500/10 border-primary-600/40 text-primary-700 dark:text-primary-500' },
          error:   { root: 'bg-error-500/10 border-error-500/30 text-error-600 dark:text-error-400' },
        },
      },
    },

    // ── UTable ────────────────────────────────────────────────────
    table: {
      slots: {
        root:  'w-full',
        thead: 'border-b border-[var(--ui-border)]',
        th:    'font-display text-[9px] tracking-[0.15em] uppercase text-[var(--ui-text-dimmed)] px-2.5 py-2 text-left',
        tbody: 'divide-y divide-[var(--ui-border)]',
        tr:    'transition-colors hover:bg-[var(--ui-bg-accented)] cursor-pointer',
        td:    'font-sans text-[13px] text-[var(--ui-text-muted)] px-2.5 py-2',
      },
    },

    // ── UTooltip ──────────────────────────────────────────────────
    tooltip: {
      slots: {
        content: 'bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-[var(--ui-text)] font-sans text-[11px] italic px-2 py-1 rounded shadow-lg',
        arrow:   'fill-[var(--ui-bg-muted)]',
      },
    },

    // ── UKbd ──────────────────────────────────────────────────────
    kbd: {
      slots: {
        base: 'inline-flex items-center bg-[var(--ui-bg-accented)] border border-[var(--ui-border)] border-b-2 rounded font-mono text-[11px] text-[var(--ui-text-muted)] px-1.5 py-0.5',
      },
    },

    // ── USeparator ────────────────────────────────────────────────
    separator: {
      slots: {
        root:   'flex items-center',
        border: 'flex-1 border-[var(--ui-border)]',
        label:  'font-display text-[10px] tracking-[0.2em] uppercase text-[var(--ui-text-dimmed)] px-3',
      },
    },

  }, // end ui
})
```

> **Why `dark:` appears at all in `app.config.ts`:** The ghost, soft, link, and alert overrides above use `dark:` for a handful of text and border shades where the Tailwind colour *value* differs between modes (e.g. `text-error-400` in dark vs `text-error-600` in light) and cannot be expressed as a single opacity-based class. All background fills and border fills use opacity utilities (`/10`, `/15`, `/30`) and therefore do not need `dark:` at all.

---

## 5. Module Setup — `nuxt.config.ts`

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],

  css: ['~/assets/css/main.css'],

  ui: {
    // Restrict dynamic color generation to only the DM Vault's palette.
    // Unlisted color names will not have their utility classes emitted,
    // keeping the CSS bundle tight.
    theme: {
      colors: [
        'primary',  // gold scale
        'error',
        'success',
        'info',
        'warning',
      ],
    },
  },

  // colorMode: user can toggle; dark is the default.
  // classSuffix: '' means Nuxt writes class="dark" not class="dark-mode".
  // storageKey: 'dmvault-color-mode' namespaces the localStorage key
  // so it doesn't clash with other apps on the same domain during dev.
  colorMode: {
    preference:  'dark',   // default for new users
    fallback:    'dark',   // used if system preference is undetectable
    classSuffix: '',       // <html class="dark"> not <html class="dark-mode">
    storageKey:  'dmvault-color-mode',
  },
})
```

---

## 6. Color Mode Toggle

Nuxt UI provides `UColorModeButton` (and `UColorModeSelect`) as ready-made toggles that read/write the `useColorMode()` composable.

### In the shared header (`components/AppHeader.vue`)

```vue
<template #right>
  <!-- UColorModeButton cycles: dark → light → system → dark -->
  <UColorModeButton />
  <UButton variant="outline" to="/campaign">Open Campaign</UButton>
</template>
```

### In the dashboard sidebar footer

```vue
<template #footer>
  <div class="flex items-center justify-between px-3 py-2">
    <PartyAvatarStrip />
    <UColorModeButton variant="ghost" size="sm" />
  </div>
</template>
```

### Reading the current mode in components

```ts
const colorMode = useColorMode()

// Reactive current value: 'dark' | 'light' | 'system'
console.log(colorMode.value)

// Computed preference for conditional logic:
const isDark = computed(() => colorMode.value === 'dark')
```

### Per-component conditional styling

When a component genuinely needs a different value in each mode and neither `dark:` nor opacity tricks work, read the composable directly:

```ts
// Character banner gradients — dark mode uses deeper shades
const bannerGradients = computed(() => {
  const dark = colorMode.value === 'dark'
  return {
    fighter: dark ? 'from-red-900 to-red-700'    : 'from-red-200 to-red-400',
    wizard:  dark ? 'from-blue-900 to-blue-700'   : 'from-blue-200 to-blue-400',
    cleric:  dark ? 'from-amber-900 to-amber-700' : 'from-amber-200 to-amber-400',
    rogue:   dark ? 'from-neutral-900 to-neutral-700' : 'from-neutral-200 to-neutral-400',
    ranger:  dark ? 'from-green-900 to-green-700' : 'from-green-200 to-green-400',
    bard:    dark ? 'from-purple-900 to-purple-700': 'from-purple-200 to-purple-400',
  }
})
```

---

## 7. UButton

All buttons use `font-display` (Cinzel) with wide letter-spacing and uppercase transforms. The `outline` variant is the default.

### Variants at a glance

| Variant | Use case | Dark | Light |
|---|---|---|---|
| `solid` | Single highest-priority CTA per view | Gold fill, near-black text | Same — primary-500 stays vivid |
| `outline` | Primary actions (default) | Gold-tinted bg, gold border | Warm cream bg, darker gold border |
| `ghost` | Secondary / utility actions | Transparent, subtle border | Transparent, khaki border |
| `soft` | Destructive actions | Red-tinted bg, light red text | Red-tinted bg, darker red text |
| `link` | Inline text links | Gold text | Darker gold text |

### Usage

```vue
<!-- CTA — solid gold fill -->
<UButton variant="solid">⚔ Start Session</UButton>

<!-- Primary action (default variant) -->
<UButton>+ Add Character</UButton>

<!-- Secondary / utility -->
<UButton variant="ghost">📊 Compare</UButton>

<!-- Danger / destructive -->
<UButton color="error" variant="soft">🗑 Delete</UButton>

<!-- Inline text link -->
<UButton variant="link">View all →</UButton>

<!-- Icon-only — square removes asymmetric padding -->
<UButton icon="i-lucide-search" variant="ghost" square />

<!-- With route navigation -->
<UButton to="/campaigns/characters">View Party</UButton>
```

### Props

| Prop | Type | Default | Values |
|---|---|---|---|
| `variant` | `string` | `'outline'` | `solid` · `outline` · `ghost` · `soft` · `link` |
| `color` | `string` | `'primary'` | `primary` · `error` · `neutral` |
| `size` | `string` | `'md'` | `sm` · `md` · `lg` |
| `square` | `boolean` | `false` | Equal width/height — use for icon-only |
| `icon` | `string` | — | Lucide icon name e.g. `i-lucide-search` |
| `loading` | `boolean` | `false` | Shows spinner, disables interaction |
| `disabled` | `boolean` | `false` | Reduces opacity, prevents clicks |
| `to` | `string` | — | Route path — passes through to `NuxtLink` |

---

## 8. UBadge

Badges carry semantic meaning through colour. `outline` is preferred for content taxonomy tags; `solid` for nav counts. All text renders in Cinzel.

### Colour semantics

| Colour | Use case |
|---|---|
| `primary` (gold) | Quest status, active states, item tags |
| `error` (red) | Alert counts, failed quests, hostile factions |
| `success` (green) | Alive/allied status, completed quests |
| `info` (blue) | Location tags, informational |
| `neutral` | Unknown / unclassified entries |
| Custom purple | NPC tags (`:ui` prop — see §19) |

### Usage

```vue
<!-- Nav count — solid, high visibility -->
<UBadge color="error" variant="solid">3</UBadge>

<!-- Quest type label — outline (default) -->
<UBadge>Main Quest</UBadge>

<!-- Session type pill -->
<UBadge color="error" variant="soft">Combat</UBadge>

<!-- Taxonomy tags via :ui prop -->
<UBadge :ui="{ base: 'bg-purple-500/20 text-purple-600 border-purple-400/50 dark:text-purple-300 dark:border-purple-500/40' }">NPC</UBadge>
<UBadge :ui="{ base: 'bg-blue-500/15 text-blue-600 border-blue-400/40 dark:text-blue-300 dark:border-blue-500/40' }">Location</UBadge>
<UBadge :ui="{ base: 'bg-primary-500/15 text-primary-700 border-primary-500/40 dark:text-primary-400 dark:border-primary-700' }">Item</UBadge>
```

### Props

| Prop | Type | Default | Values |
|---|---|---|---|
| `variant` | `string` | `'outline'` | `solid` · `outline` · `soft` · `subtle` |
| `color` | `string` | `'primary'` | `primary` · `error` · `success` · `info` · `neutral` |
| `size` | `string` | `'sm'` | `xs` · `sm` · `md` |

---

## 9. UCard

The primary layout container. Background, border and hover states all resolve from `--ui-*` tokens — no per-mode code needed in templates. The gold shimmer line on the top edge is controlled by `.dmvault-card::before` in `main.css`.

### Slots

| Slot | Content |
|---|---|
| `#header` | Card title + action — uses micro-label Cinzel styling |
| default | Card body — main content |
| `#footer` | Action buttons — right-aligned |

### Usage

```vue
<UCard>
  <template #header>
    <span class="font-display text-[10px] tracking-[0.14em] uppercase text-[var(--ui-text-dimmed)]">
      Quest Log
    </span>
    <UButton variant="link" size="sm">+ New Quest</UButton>
  </template>

  <QuestList />

  <template #footer>
    <UButton variant="ghost">Cancel</UButton>
    <UButton>Save</UButton>
  </template>
</UCard>
```

---

## 10. UTabs

The in-panel navigation pattern. The default pill indicator is hidden globally; a bottom-border underline is used instead. Labels always render in Cinzel uppercase. The active gold border (`primary-500`) is vivid enough to read in both modes.

### Usage

```vue
<UTabs
  :items="[
    { label: 'Overview',   slot: 'overview'   },
    { label: 'Characters', slot: 'characters' },
    { label: 'World',      slot: 'world'      },
    { label: 'Notes',      slot: 'notes'      },
    { label: 'History',    slot: 'history'    },
  ]"
>
  <template #overview>   <OverviewPanel />   </template>
  <template #characters> <CharactersPanel /> </template>
  <template #world>      <WorldPanel />      </template>
  <template #notes>      <NotesPanel />      </template>
  <template #history>    <HistoryPanel />    </template>
</UTabs>
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `items` | `TabItem[]` | — | `{ label, slot, icon?, disabled? }` |
| `defaultValue` | `string` | First item | Initial active tab by slot name |

---

## 11. UInput & UTextarea

Background, border and text colours are all `--ui-*` token references in the global override, so the input field reads correctly against either mode's page background automatically.

### Label pattern (UFormField)

Always use `UFormField` for labels — never raw `<label>` tags.

```vue
<UFormField label="Session Title">
  <UInput v-model="sessionTitle" placeholder="Into the Catacombs..." />
</UFormField>
```

### Input states

```vue
<!-- Default -->
<UInput v-model="value" placeholder="Filter quests..." />

<!-- Error state via UFormField -->
<UFormField label="Character Name" error="Name must be at least 3 characters.">
  <UInput v-model="name" color="error" />
</UFormField>

<!-- With leading icon -->
<UInput v-model="search" icon="i-lucide-search" placeholder="Search..." />

<!-- With keyboard shortcut trailing slot -->
<UInput v-model="value">
  <template #trailing>
    <div class="flex gap-0.5">
      <UKbd>⌘</UKbd>
      <UKbd>K</UKbd>
    </div>
  </template>
</UInput>
```

### Textarea

```vue
<UFormField label="Session Notes">
  <UTextarea
    v-model="notes"
    :rows="6"
    placeholder="Jot down key moments from this session..."
  />
</UFormField>
```

### Props (UInput)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `string` | `'md'` | `sm` · `md` · `lg` |
| `color` | `string` | `'neutral'` | `neutral` · `error` |
| `icon` | `string` | — | Lucide icon name, renders as leading icon |
| `placeholder` | `string` | — | Italicised via global override |
| `disabled` | `boolean` | `false` | Reduces opacity |

---

## 12. UAvatar

Party portraits render as circular avatars with an optional HP status chip. Background, border and chip border all use `--ui-*` tokens. Hovering lifts the avatar 2px.

### Chip colour semantics

| Chip colour | Meaning |
|---|---|
| `success` (green) | Alive / full HP |
| `warning` (amber) | Wounded |
| `error` (red) | Critical HP / unconscious |
| `neutral` (grey) | Dead / removed from party |

### Usage

```vue
<!-- Party strip -->
<UAvatar
  v-for="char in party"
  :key="char.id"
  :src="char.portrait"
  :alt="char.name"
  size="md"
  :chip-color="hpChipColor(char)"
  chip-position="bottom-right"
/>

<!-- Add-character placeholder — adapts to mode via :ui -->
<UAvatar
  :ui="{
    root: 'border-dashed border-[var(--ui-border-accented)] bg-transparent text-[var(--ui-text-dimmed)] hover:border-[var(--ui-primary)] hover:text-[var(--ui-text-muted)] cursor-pointer'
  }"
  size="md"
>
  +
</UAvatar>
```

### Computed chip colour from HP

```ts
const hpChipColor = (char: Character) => {
  const pct = char.hp / char.maxHp
  if (pct > 0.5)  return 'success'
  if (pct > 0.25) return 'warning'
  return 'error'
}
```

### Props

| Prop | Type | Default | Values |
|---|---|---|---|
| `size` | `string` | `'md'` | `sm` · `md` · `lg` · `xl` |
| `src` | `string` | — | Portrait image URL |
| `alt` | `string` | — | Always set for accessibility |
| `chip-color` | `string` | — | `success` · `warning` · `error` · `neutral` |

---

## 13. UProgress

HP bars, XP progress, and faction reputation. The track uses `--ui-bg-muted` which is a dark surface in dark mode and a tan fill in light mode — both give the gradient fill enough contrast to be readable.

### HP states

| State | Threshold | Colour |
|---|---|---|
| Healthy | > 50% | `success` |
| Wounded | 25–50% | `warning` |
| Critical | < 25% | `error` |

### Usage

```vue
<!-- HP bar — colour computed from percentage -->
<UProgress :value="character.hp" :max="character.maxHp" :color="hpColor(character)" size="sm" />

<!-- XP bar — always primary gold -->
<UProgress :value="character.xp" :max="character.xpToNextLevel" color="primary" size="md" />
```

### Computed helper

```ts
const hpColor = (char: Character) => {
  const pct = char.hp / char.maxHp
  if (pct > 0.5)  return 'success'
  if (pct > 0.25) return 'warning'
  return 'error'
}
```

### Props

| Prop | Type | Default | Values |
|---|---|---|---|
| `value` | `number` | — | Current value |
| `max` | `number` | `100` | Maximum value |
| `color` | `string` | `'primary'` | `primary` · `success` · `warning` · `error` |
| `size` | `string` | `'md'` | `sm` · `md` · `lg` |

---

## 14. UAlert

In-game warnings, session reminders, system notices. Tinted backgrounds use `/10` opacity so they sit correctly on both dark and light `--ui-bg`. Foreground text uses `dark:` to shift between light-readable and dark-readable shades.

### Colour semantics

| Colour | Use case |
|---|---|
| `warning` (gold) | Time-sensitive in-game reminders |
| `error` (red) | Critical HP, death saves, hostile encounters |
| `success` (green) | Quest completed, level-up, ally gained |
| `info` (blue) | Autosave, session synced, system notice |

### Usage

```vue
<UAlert
  color="warning"
  icon="i-lucide-moon"
  title="Full Moon in 3 Days"
  description="Strahd grows stronger. Plan accordingly."
/>

<UAlert
  color="error"
  icon="i-lucide-skull"
  title="Miriel at Critical HP"
  description="23/52 HP — consider a healing action."
/>
```

---

## 15. UTable

Encounter lists, loot tables, NPC rosters. Header, row dividers and hover states all use `--ui-*` token references in the global override.

### Usage

```vue
<UTable
  :columns="[
    { key: 'name',   label: 'Character' },
    { key: 'class',  label: 'Class'     },
    { key: 'hp',     label: 'HP'        },
    { key: 'status', label: 'Status'    },
  ]"
  :rows="party"
>
  <template #status-data="{ row }">
    <UBadge :color="row.statusColor">{{ row.status }}</UBadge>
  </template>

  <template #hp-data="{ row }">
    <div class="flex items-center gap-2">
      <span class="font-display text-xs text-[var(--ui-text-muted)]">
        {{ row.hp }}/{{ row.maxHp }}
      </span>
      <UProgress :value="row.hp" :max="row.maxHp" :color="hpColor(row)" size="sm" class="w-16" />
    </div>
  </template>
</UTable>
```

### Active initiative row

```vue
<UTable
  :rows="initiativeOrder"
  :ui="{
    tr: (row) => row.isActive
      ? 'bg-primary-500/8 border-l-2 border-l-primary-500 animate-pulse-ring'
      : 'hover:bg-[var(--ui-bg-accented)] cursor-pointer'
  }"
/>
```

---

## 16. UTooltip

Tooltip background uses `--ui-bg-muted`, which is dark in dark mode and a warm tan in light mode. Text uses `--ui-text`. No per-mode code needed in templates.

### Usage

```vue
<!-- Avatar portrait tooltip -->
<UTooltip :text="`${char.name} · ${char.class} · HP: ${char.hp}/${char.maxHp}`">
  <UAvatar :src="char.portrait" size="md" />
</UTooltip>

<!-- Stat block — delayed to avoid accidental triggers -->
<UTooltip text="Strength modifier (+3)" :delay="500">
  <span class="font-display text-primary-500 text-lg cursor-help">+3</span>
</UTooltip>
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | `string` | — | Tooltip content |
| `delay` | `number` | `0` | Open delay in ms |
| `placement` | `string` | `'top'` | `top` · `bottom` · `left` · `right` |

---

## 17. UKbd

Keyboard shortcut labels in the command palette and Notes editor toolbar. Background and border use `--ui-*` tokens; the recessed `border-b-2` keycap effect works in both modes.

### Usage

```vue
<!-- Input trailing slot -->
<UInput placeholder="Search...">
  <template #trailing>
    <div class="flex gap-0.5">
      <UKbd>⌘</UKbd><UKbd>K</UKbd>
    </div>
  </template>
</UInput>
```

---

## 18. USeparator

Section dividers, between card groups, between quest types. Uses `--ui-*` border tokens automatically.

### Usage

```vue
<USeparator />
<USeparator label="Active Quests" />
<USeparator label="Session XIV" />
```

---

## 19. The `:ui` Prop — Per-Instance Overrides

Use the `:ui` prop when a single instance needs to deviate from the global `app.config.ts` override. Nuxt UI uses `tailwind-merge` internally so `:ui` classes always win without `!important`.

**Mode-aware rule:** Prefer `--ui-*` CSS variable references in `:ui` overrides. Add `dark:`/`light:` Tailwind prefixes only when a concrete shade is required and the opacity trick won't work.

### Pattern 1 — Character banner strips

```vue
<UCard :ui="{ root: 'overflow-hidden', header: `before:block before:h-[5px] before:bg-gradient-to-r ${bannerGradients[char.class]} px-4 pt-3 pb-2.5` }">
```

Banner gradient map (both modes — see §6 for how to make these reactive to `useColorMode`):

```ts
// Dark mode variants (see §6 for light mode equivalents)
const darkBanners: Record<string, string> = {
  fighter: 'from-red-900 to-red-700',
  wizard:  'from-blue-900 to-blue-700',
  cleric:  'from-amber-900 to-amber-700',
  rogue:   'from-neutral-900 to-neutral-700',
  ranger:  'from-green-900 to-green-700',
  bard:    'from-purple-900 to-purple-700',
}

// Light mode variants
const lightBanners: Record<string, string> = {
  fighter: 'from-red-100 to-red-300',
  wizard:  'from-blue-100 to-blue-300',
  cleric:  'from-amber-100 to-amber-300',
  rogue:   'from-neutral-100 to-neutral-300',
  ranger:  'from-green-100 to-green-300',
  bard:    'from-purple-100 to-purple-300',
}
```

### Pattern 2 — Content taxonomy tag colours

```ts
// Uses opacity-based classes — same strings work in both modes
const tagStyles: Record<string, string> = {
  npc:      'bg-purple-500/20 text-purple-600 border-purple-400/50 dark:text-purple-300 dark:border-purple-500/40',
  location: 'bg-blue-500/15  text-blue-600   border-blue-400/40   dark:text-blue-300   dark:border-blue-500/40',
  item:     'bg-primary-500/15 text-primary-700 border-primary-500/40 dark:text-primary-400 dark:border-primary-700',
  combat:   'bg-error-500/15 text-error-600   border-error-400/40  dark:text-error-400   dark:border-error-900',
  lore:     'bg-success-500/15 text-success-600 border-success-400/40 dark:text-success-400 dark:border-success-700',
}
```

```vue
<UBadge :ui="{ base: tagStyles[tag.type] }">{{ tag.label }}</UBadge>
```

### Pattern 3 — Active initiative turn

```vue
<UCard
  :ui="{
    root: isActive
      ? 'border-primary-500 bg-primary-500/8 animate-pulse-ring'
      : 'border-[var(--ui-border)]'
  }"
/>
```

### Pattern 4 — Quest status pulse dot

```vue
<div class="relative inline-flex">
  <UBadge variant="outline">{{ quest.title }}</UBadge>
  <span
    v-if="quest.active"
    class="absolute -top-1 -right-1 size-1.5 rounded-full bg-primary-500 animate-pulse"
  />
</div>
```

### Pattern 5 — Spell slot pip grid

```vue
<div class="flex gap-1 flex-wrap">
  <button
    v-for="(used, i) in spellSlots"
    :key="i"
    class="size-3 rounded-[2px] border transition-all"
    :class="used ? 'pip-filled' : 'bg-transparent border-[var(--ui-border)] hover:border-[var(--ui-border-accented)]'"
    @click="toggleSlot(i)"
  />
</div>
```

> `pip-filled` is a utility class defined in `main.css` that maps to the correct shade per mode (see §3).

---

## 20. Layout Architecture Overview

Every page in The DM Vault is composed from three stacking layers:

```
┌─────────────────────────────────────────────────────────┐
│  app.vue                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  <NuxtLayout name="dashboard | docs | default">   │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Page component  (pages/**/*.vue)            │ │ │
│  │  │  ┌────────────────────────────────────────┐  │ │ │
│  │  │  │  Nested content / sub-routes           │  │ │ │
│  │  │  └────────────────────────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Layer 1 — `app.vue`**: A minimal shell containing only `UApp`, `UMain`, and `NuxtLayout`. It owns no visible chrome. Header, footer, and sidebar are the responsibility of each layout.

**Layer 2 — Layout files** (`layouts/*.vue`): Slot-based wrappers providing the structural chrome for a section of the app.

**Layer 3 — Page files** (`pages/**/*.vue`): Route content. Each page picks its layout via `definePageMeta({ layout: 'name' })` or inherits `default`.

---

## 21. The Minimal Shell — `app.vue`

`app.vue` contains only `UApp`, `UMain`, and `NuxtLayout`. It owns no visible chrome. Header, footer, and sidebar are each layout's responsibility — this is what allows the `auth` layout (and any future chrome-free layout) to render with a completely blank canvas without `v-if` guards in `app.vue`.

`UApp` must be the root element. It sets up the color mode context, toast providers, and the `--ui-header-height` CSS variable consumed by `UMain` and `UPageAside`.

```vue
<!-- app.vue -->
<template>
  <UApp>
    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>
  </UApp>
</template>
```

### Shared components

Chrome that is used by more than one layout — the site header, the site footer — lives in `components/` and is composed into the layouts that need it.

**`components/AppHeader.vue`** — used by `default.vue` and `docs.vue`:

```vue
<!-- components/AppHeader.vue -->
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: 'Campaign',   to: '/campaign',   icon: 'i-lucide-scroll',    active: route.path.startsWith('/campaign') },
  { label: 'Rules',      to: '/docs',       icon: 'i-lucide-book-open', active: route.path.startsWith('/docs') },
  { label: 'Compendium', to: '/compendium', icon: 'i-lucide-library' },
])
</script>

<template>
  <UHeader>
    <template #title>
      <span class="font-display text-primary-500 text-sm tracking-widest uppercase">
        The DM Vault
      </span>
    </template>

    <UNavigationMenu :items="navItems" />

    <template #right>
      <UColorModeButton />
      <UButton variant="outline" to="/campaign">Open Campaign</UButton>
    </template>

    <!-- Mobile collapsed menu -->
    <template #body>
      <UNavigationMenu :items="navItems" orientation="vertical" />
    </template>
  </UHeader>
</template>
```

**`components/AppFooter.vue`** — used by `default.vue`:

```vue
<!-- components/AppFooter.vue -->
<template>
  <UFooter>
    <template #left>
      <span class="font-display text-[10px] tracking-widest uppercase text-[var(--ui-text-dimmed)]">
        The DM Vault
      </span>
    </template>
    <template #right>
      <UColorModeButton variant="ghost" size="sm" />
    </template>
  </UFooter>
</template>
```

> **`active` state on nav items:** Always set `active` explicitly using `route.path.startsWith()`. This correctly highlights parent items when a child route is active (e.g. highlighting "Campaign" for any `/campaigns/**` URL).

---

## 22. Layout Types

### 22.1 Default Layout — Marketing / Landing

**Use for:** Homepage, marketing pages, pricing, changelog, blog index.

```
┌──────────────────────────────────────────┐
│  UHeader  (sticky, full-width)           │
├──────────────────────────────────────────┤
│  UPageHero                               │
│  UPageSection × N                        │
│  UPageGrid / UPageColumns                │
├──────────────────────────────────────────┤
│  UFooter                                 │
└──────────────────────────────────────────┘
```

```vue
<!-- layouts/default.vue -->
<template>
  <AppHeader />
  <UMain>
    <slot />
  </UMain>
  <AppFooter />
</template>
```

```vue
<!-- pages/index.vue — no definePageMeta needed -->
<template>
  <UPageHero title="The DM Vault" description="Your D&D campaign, chronicled." :links="heroLinks" />
  <UPageSection title="Features" align="center">
    <UPageGrid>
      <UPageCard v-for="f in features" :key="f.title" v-bind="f" />
    </UPageGrid>
  </UPageSection>
</template>
```

**When NOT to use:** Any page needing a persistent sidebar or fixed app chrome.

---

### 22.2 Docs Layout — Two-Column with Sidebar

**Use for:** Rules reference, class guides, spell indexes.

```
┌──────────────────────────────────────────────────────────┐
│  UHeader (sticky, global)                                │
├───────────────┬──────────────────────────┬───────────────┤
│  UPageAside   │  UPageHeader             │  UPageAside   │
│  (left)       │  UPageBody               │  (right)      │
│  UContent     │  UContentSurround        │  UContentToc  │
│  Navigation   │                          │               │
└───────────────┴──────────────────────────┴───────────────┘
```

```vue
<!-- layouts/docs.vue -->
<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

// Navigation data is fetched and provided here, scoped to docs routes.
// Any page rendered inside this layout can inject 'navigation'.
const { data: navigation } = await useAsyncData('navigation', () =>
  queryCollectionNavigation('docs')
)
provide('navigation', navigation)
</script>

<template>
  <AppHeader />
  <UMain>
    <UPage>
      <template #left>
        <UPageAside>
          <UContentNavigation :navigation="navigation" highlight />
        </UPageAside>
      </template>
      <slot />
    </UPage>
  </UMain>
</template>
```

```vue
<!-- pages/docs/[...slug].vue -->
<script setup lang="ts">
definePageMeta({ layout: 'docs' })
const route = useRoute()
const { data: page } = await useAsyncData(route.path, () =>
  queryCollection('docs').path(route.path).first()
)
const { data: surround } = await useAsyncData(`${route.path}-surround`, () =>
  queryCollectionItemSurroundings('content', route.path)
)
</script>

<template>
  <!-- The layout provides the left column. This slot fills the centre.
       A #right slot on UPage (inside the layout's UPage) provides the TOC. -->
  <UPage>
    <UPageHeader :title="page.title" :description="page.description" :headline="page.category" />
    <UPageBody>
      <ContentRenderer :value="page" />
      <USeparator />
      <UContentSurround :surround="surround" />
    </UPageBody>
    <template #right>
      <UContentToc :links="page.body.toc.links" />
    </template>
  </UPage>
</template>
```

**When NOT to use:** App views that require persistent state (the campaign tracker), or auth pages.

---

### 22.3 Dashboard Layout — Fixed App Shell

**Use for:** The core campaign tracker — Overview, Characters, World, Notes, History. The full viewport is owned by the layout; panel content scrolls independently. This layout renders no `AppHeader` or `AppFooter` — the `UDashboardNavbar` inside each panel provides contextual navigation instead.

```
┌──────────────────────────────────────────────────────────┐
│  UDashboardGroup  (fixed inset-0)                        │
│  ┌──────────────┬─────────────────────────────────────┐  │
│  │              │  UDashboardNavbar                   │  │
│  │  UDashboard  ├─────────────────────────────────────┤  │
│  │  Sidebar     │                                     │  │
│  │              │  <slot /> — panel content           │  │
│  │  Nav links   │                                     │  │
│  │  Party strip │                                     │  │
│  │  Mode toggle │                                     │  │
│  └──────────────┴─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

```vue
<!-- layouts/dashboard.vue -->
<script setup lang="ts">
const navLinks = [
  { label: 'Campaign',   type: 'label' },
  { label: 'Overview',   icon: 'i-lucide-layout-dashboard', to: '/campaign' },
  { label: 'Characters', icon: 'i-lucide-users',            to: '/campaigns/characters', badge: { label: '4', color: 'primary', variant: 'outline' } },
  { label: 'World',      icon: 'i-lucide-map',              to: '/campaigns/world' },
  { label: 'Session',    type: 'label' },
  { label: 'Notes',      icon: 'i-lucide-scroll-text',      to: '/campaigns/notes' },
  { label: 'History',    icon: 'i-lucide-clock',            to: '/campaigns/history' },
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="14"
      :default-size="18"
      :max-size="28"
      :collapsed-size="0"
    >
      <template #header="{ collapsed }">
        <span v-if="!collapsed" class="font-display text-primary-500 text-sm tracking-widest uppercase px-2">
          The DM Vault
        </span>
        <UDashboardSidebarCollapse />
      </template>

      <UNavigationMenu :items="navLinks" orientation="vertical" />

      <template #footer>
        <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--ui-border)]">
          <PartyAvatarStrip />
          <!-- Color mode toggle in sidebar footer -->
          <UColorModeButton variant="ghost" size="sm" />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
```

```vue
<!-- pages/campaigns/index.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Overview" />
    </template>
    <CampaignOverviewGrid />
  </UDashboardPanel>
</template>
```

**When NOT to use:** Landing, auth, or docs pages. Dashboard layout uses `fixed inset-0` and owns the entire viewport.

---

### 22.4 Auth Layout — Minimal Chrome

**Use for:** Login, sign-up, forgot password. No `AppHeader`, no `AppFooter`, no sidebar — just a blank canvas with a centred card. Because `app.vue` is a minimal shell, this layout needs no special guards to suppress chrome; it simply doesn't include it.

```
┌──────────────────────────────────────────┐
│                                          │
│          ┌──────────────────┐            │
│          │    UAuthForm     │            │
│          └──────────────────┘            │
│                                          │
└──────────────────────────────────────────┘
```

```vue
<!-- layouts/auth.vue -->
<template>
  <!-- Full-viewport centred shell. bg-[var(--ui-bg)] adapts to color mode. -->
  <div class="min-h-screen flex items-center justify-center bg-[var(--ui-bg)]">
    <slot />
  </div>
</template>
```

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'auth' })
</script>

<template>
  <UAuthForm
    title="Welcome back, DM"
    description="Sign in to continue your campaign."
    :fields="loginFields"
    :providers="['google']"
    @submit="handleLogin"
  />
</template>
```

---

## 23. Nested Page Structures

### 23.1 Page with Left Aside (Docs)

The `docs` layout provides the `#left` column via its own `UPage` wrapper (see §22.2). Individual pages do not need to redeclare the left aside — they receive the centre column as `<slot />` from the layout.

```vue
<!-- layouts/docs.vue owns this: -->
<UPage>
  <template #left>
    <UPageAside>
      <UContentNavigation :navigation="navigation" highlight />
    </UPageAside>
  </template>
  <slot />   <!-- ← page content arrives here -->
</UPage>
```

> `UPageAside` sticks at `top: var(--ui-header-height)` and scrolls independently of the main column.

### 23.2 Page with Right Aside (TOC)

```vue
<UPage>
  <UPageHeader :title="page.title" :description="page.description" />
  <UPageBody>
    <ContentRenderer :value="page" />
  </UPageBody>
  <template #right>
    <UContentToc :links="page.body.toc.links">
      <template #bottom>
        <UPageLinks title="Reference" :links="pageLinks" />
      </template>
    </UContentToc>
  </template>
</UPage>
```

### 23.3 Page with Both Asides (Three-Column)

The `docs` layout owns the `#left` column. Each individual page adds the `#right` column by wrapping its content in a `UPage` with a `#right` slot. Both `UPage` instances compose correctly because named slots are resolved independently at each level.

```
Layout's UPage  → provides #left (navigation tree)
Page's UPage    → provides #right (table of contents)
                  centre column = page body
```

See `layouts/docs.vue` and `pages/docs/[...slug].vue` in §22.2 for the complete implementation.

### 23.4 Dashboard: Two Panels (List + Detail)

```
┌──────────────┬──────────────────────┬──────────────────┐
│  Sidebar     │  Character List      │  Character Sheet │
│  (layout)    │  UDashboardPanel     │  UDashboardPanel │
│              │  resizable           │  (detail)        │
└──────────────┴──────────────────────┴──────────────────┘
```

```vue
<!-- pages/campaigns/characters/index.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
</script>

<template>
  <UDashboardPanel
    :default-size="35"
    resizable
    :min-size="25"
    storage-key="dmvault-characters-list"
  >
    <template #header>
      <UDashboardNavbar title="Characters">
        <template #right>
          <UButton>+ Add Character</UButton>
        </template>
      </UDashboardNavbar>
    </template>
    <CharacterList />
  </UDashboardPanel>

  <UDashboardPanel storage-key="dmvault-characters-detail">
    <template #header>
      <UDashboardNavbar :title="selectedCharacter?.name ?? 'Select a character'" />
    </template>
    <CharacterSheet :character="selectedCharacter" />
  </UDashboardPanel>
</template>
```

> Panel sizes persist via cookies. Always use a unique `storage-key` per panel using the pattern `'dmvault-{view}-{role}'`.

---

## 24. Navigation Patterns

### 24.1 Top-Level Header Navigation

Defined in `components/AppHeader.vue` (see §21) and composed into `layouts/default.vue` and `layouts/docs.vue`. Key rules:

- Always set `active` via `route.path.startsWith()` for prefix matching
- `UColorModeButton` lives in the `#right` slot of `AppHeader`
- Mobile menu goes in the `#body` slot

### 24.2 Dashboard Sidebar Navigation

Navigation menu structure with grouped labels (see `layouts/dashboard.vue` in §22.3):

```ts
// type: 'label' items render as non-clickable group headings
const links = [
  { label: 'Campaign', type: 'label' },
  { label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/campaign' },
  // ...
]
```

> Vue Router's `useLink` handles active state automatically for sidebar links. No manual `active` prop needed.

### 24.3 Docs Sidebar Navigation

Navigation data is fetched and provided inside `layouts/docs.vue`, scoped to docs routes. Pages rendered inside the docs layout can inject `'navigation'` if they need to reference it directly, but most pages only need the layout's `UContentNavigation` — no inject required in normal page components.

```vue
<!-- layouts/docs.vue — fetches and provides navigation data -->
<script setup lang="ts">
const { data: navigation } = await useAsyncData('navigation', () =>
  queryCollectionNavigation('docs')
)
provide('navigation', navigation)
</script>

<!-- Any docs page that needs to reference navigation items directly: -->
<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')
</script>
```

### 24.4 Breadcrumbs

Show at route depth ≥ 3 inside `UDashboardNavbar`:

```vue
<UDashboardNavbar>
  <template #leading>
    <UBreadcrumb :items="[
      { label: 'Campaign',   to: '/campaign' },
      { label: 'Characters', to: '/campaigns/characters' },
      { label: 'Valen Ashford' },  <!-- no to = current page -->
    ]" />
  </template>
</UDashboardNavbar>
```

### 24.5 In-Page Tabs (`UTabs`)

Use `UTabs` for multiple discrete content modes that share the same page state and don't need separate URLs.

```vue
<UTabs
  :items="[
    { label: 'Stats',     slot: 'stats'     },
    { label: 'Spells',    slot: 'spells'    },
    { label: 'Equipment', slot: 'equipment' },
    { label: 'Notes',     slot: 'notes'     },
  ]"
>
  <template #stats>    <CharacterStats    /> </template>
  <template #spells>   <CharacterSpells   /> </template>
  <template #equipment><CharacterGear     /> </template>
  <template #notes>    <CharacterNotes    /> </template>
</UTabs>
```

| Use `UTabs` | Use separate routes |
|---|---|
| Content shares page state (e.g. selected character) | Content is independently bookmarkable |
| Switching is instant, no re-fetch | Each view has its own `<title>` / meta |
| Mobile: all tabs visible at once | Content is substantial enough to warrant a URL |

### 24.6 Prev / Next Navigation

Docs pages only — use `UContentSurround`:

```vue
<UPageBody>
  <ContentRenderer :value="page" />
  <USeparator class="my-8" />
  <UContentSurround :surround="surround" />
</UPageBody>
```

---

## 25. Programmatic Navigation

### `NuxtLink` / `to` prop (declarative — preferred)

Always use the `to` prop on Nuxt UI components or explicit `<NuxtLink>` for internal links. Never use bare `<a>` tags — they break SPA routing and disable prefetching.

```vue
<UButton to="/campaigns/characters">View Party</UButton>

<NuxtLink to="/campaign">
  <UAvatar src="/logo.png" />
</NuxtLink>
```

### `navigateTo` (programmatic)

```ts
// After saving
await navigateTo('/campaigns/notes')

// Replace history entry
await navigateTo('/campaign', { replace: true })

// External link
await navigateTo('https://dndbeyond.com', { external: true, open: { target: '_blank' } })
```

### `useRouter` (escape hatch)

```ts
const router = useRouter()
router.back()

// Conditional back-or-home
if (window.history.length > 1) router.back()
else navigateTo('/campaign')
```

### `useRoute` (reading current route)

```ts
const route = useRoute()
route.path        // '/campaigns/characters/42'
route.params.id   // '42'
route.query.tab   // 'spells'
```

---

## 26. Layout Decision Guide

| Page type | Layout | `UHeader` | Sidebar | Scrolls | Mode toggle location |
|---|---|---|---|---|---|
| Homepage / landing | `default` | ✅ | ❌ | Full page | Header `#right` |
| Marketing section | `default` | ✅ | ❌ | Full page | Header `#right` |
| Blog post | `default` | ✅ | ❌ | Full page | Header `#right` |
| Rules reference | `docs` | ✅ | Left nav | Centre column | Header `#right` |
| Class / spell guide | `docs` | ✅ | Left nav | Centre column | Header `#right` |
| Campaign dashboard | `dashboard` | ❌ | Fixed sidebar | Panel only | Sidebar footer |
| Character sheet | `dashboard` | ❌ | Fixed sidebar | Panel only | Sidebar footer |
| Notes editor | `dashboard` | ❌ | Fixed sidebar | Panel only | Sidebar footer |
| Login / Register | `auth` | ❌ | ❌ | Viewport-centred | — |
| Error page | `default` | ✅ | ❌ | Full page | Header `#right` |

---

## 27. File Structure Reference

```
app.vue                             ← minimal shell: UApp + UMain + NuxtLayout only

assets/css/main.css                 ← @theme tokens, :root (dark), .light overrides
app.config.ts                       ← global component overrides (mode-agnostic)
nuxt.config.ts                      ← @nuxt/ui module, colorMode config

components/
  AppHeader.vue                     ← shared header — used by default + docs layouts
  AppFooter.vue                     ← shared footer — used by default layout

layouts/
  default.vue                       ← AppHeader + UMain + slot + AppFooter
  docs.vue                          ← AppHeader + UMain + UPage (#left aside) + slot
  dashboard.vue                     ← UDashboardGroup + UDashboardSidebar + slot (no header/footer)
  auth.vue                          ← plain centred shell (no header/footer)

pages/
  index.vue                         ← Landing (default layout, implied)
  login.vue                         ← Auth (layout: auth)

  docs/
    [...slug].vue                   ← Docs content (layout: docs)

  campaign/
    index.vue                       ← Overview (layout: dashboard)
    characters/
      index.vue                     ← List + detail panels
      [id].vue                      ← Character sheet
    world/
      index.vue                     ← World map + locations
    notes/
      index.vue                     ← Notes editor
    history/
      index.vue                     ← Session history
```

---

## 28. Variants Quick Reference

### Component defaults

| Component | `color` | `variant` | `size` | Default |
|---|---|---|---|---|
| `UButton` | `primary` · `error` · `neutral` | `solid` · `outline` · `ghost` · `soft` · `link` | `sm` · `md` · `lg` | `outline / primary / md` |
| `UBadge` | `primary` · `error` · `success` · `info` · `neutral` | `solid` · `outline` · `soft` · `subtle` | `xs` · `sm` · `md` | `outline / primary / sm` |
| `UCard` | — | `outline` · `soft` · `subtle` · `solid` | — | `outline` |
| `UInput` | `neutral` · `error` | — | `sm` · `md` · `lg` | `neutral / md` |
| `UTextarea` | `neutral` · `error` | — | — | `neutral / md` |
| `UAvatar` | `chipColor`: `success` · `warning` · `error` · `neutral` | — | `sm` · `md` · `lg` · `xl` | `md` |
| `UProgress` | `primary` · `success` · `warning` · `error` | — | `sm` · `md` · `lg` | `primary / md` |
| `UAlert` | `info` · `success` · `warning` · `error` | `subtle` · `solid` · `outline` · `soft` | — | `subtle` |
| `UTabs` | — | — | — | Underline, pill hidden |
| `UTable` | — | — | — | `--ui-*` hover + divide |
| `UTooltip` | — | — | — | `--ui-bg-muted` bg, italic |
| `UKbd` | — | — | — | `--ui-bg-accented`, recessed border |
| `USeparator` | — | — | — | `--ui-border` |

### HP percentage → colour map

| HP % | `UProgress color` | `UAvatar chip-color` | Text class |
|---|---|---|---|
| > 50% | `success` | `success` | `text-[var(--ui-text-muted)]` |
| 25–50% | `warning` | `warning` | `text-warning-600 dark:text-warning-400` |
| < 25% | `error` | `error` | `text-error-600 dark:text-error-400` |
| 0 / down | `error` | `neutral` | `text-[var(--ui-text-dimmed)]` |

### Session type badge map

| Session type | `color` | `variant` |
|---|---|---|
| Combat | `error` | `soft` |
| Roleplay | `info` | `soft` |
| Exploration | `success` | `soft` |
| Discovery | `primary` | `outline` |
| Story | `neutral` | `outline` |

---

## 29. DM Vault Specific Rules

### Theme

1. **Dark is the default.** `nuxt.config.ts` sets `preference: 'dark'`. New users always see dark mode first.

2. **Light mode is aged parchment, not white.** Never use pure whites (`#ffffff`, `bg-white`) in any template, component override, or `:ui` prop. The lightest surface is `#f5efe4`.

3. **Use `--ui-*` CSS variable references, not hardcoded palette classes, in `app.config.ts`.** This is the primary mechanism that makes overrides work in both modes. Use `bg-[var(--ui-bg-elevated)]` not `bg-neutral-900`.

4. **Add `dark:` Tailwind prefixes only when an opacity trick is insufficient.** Opacity-based fills (`/10`, `/15`, `/20`) are preferred because the same class reads correctly on both background colours. Reserve `dark:` for cases where a concrete shade is needed on foreground text or borders.

5. **Never use bare `dark:` classes in page templates.** If a template needs to react to the current mode, use `bg-[var(--ui-bg-elevated)]` or, when a concrete shade is genuinely required, read `useColorMode()` directly.

### Layouts

6. **Dashboard layout always wins for `/campaigns/**`.** Never use `default` or `docs` layouts for campaign views.

7. **Dashboard routes have no `AppHeader` or `AppFooter` because `layouts/dashboard.vue` doesn't include them.** No `v-if` guard is needed in `app.vue` — each layout is fully responsible for its own chrome.

8. **`UColorModeButton` has two homes:** `AppHeader.vue` (used by `default` and `docs` layouts) and the dashboard sidebar footer (inside `layouts/dashboard.vue`). It should never appear in both places simultaneously.

9. **Always set a unique `storage-key` on resizable panels.** Use `'dmvault-{view}-{role}'` (e.g. `'dmvault-characters-list'`). This prevents panel widths from bleeding between views on refresh.

10. **The sidebar always uses `collapsible` + `collapsed-size="0"`.** The sidebar either shows fully or hides completely. Never use icon-only collapsed mode — Cinzel text truncates unreadably at narrow widths.

### Navigation

11. **Never use bare `<a>` tags for internal navigation.** Always use the `to` prop on Nuxt UI components or `<NuxtLink>`. Bare anchors break SPA routing and prefetching.

12. **Sidebar links never need a manual `active` prop.** Vue Router handles this via `useLink`. Only set `active` manually on nav items in `AppHeader.vue` where prefix matching is required.

13. **`UTabs` are for in-panel navigation only.** Section-level navigation (Overview, Characters, World, Notes, History) always uses the sidebar, never tabs.

14. **Breadcrumbs appear at route depth ≥ 3.** Pattern: `Campaign > Section > Item`. The section root (e.g. `/campaigns/characters`) shows only "Characters" as the plain navbar title.

### Typography

15. **All navigation labels use `font-display` (Cinzel).** Enforced globally in `app.config.ts` via `UTabs` trigger slot and `UNavigationMenu` overrides. Never override to `font-sans` in a nav element.

16. **Badge counts use `color: 'error'` for alerts, `color: 'primary'` for informational counts.** Never `color: 'neutral'` for counts in the sidebar — it is too low-contrast against `--ui-bg-elevated` in both modes.

---

> **Tailwind Merge:** Because Nuxt UI uses `tailwind-merge`, classes added via `:ui` or `class` always override conflicting defaults. There is no need for `!important`.

---

*Last updated: The DM Vault v1.0 · Nuxt UI v4.x · Light & Dark Mode*
