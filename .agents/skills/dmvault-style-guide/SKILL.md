---
name: dmvault-style-guide
description: Apply the DND Campaign Nuxt 4 Nuxt UI style guide for theme tokens, Nuxt UI global overrides, layout architecture, and navigation behavior. Use for any frontend work touching app/assets/css/main.css, app/app.config.ts, layouts, page shells, cards, tabs, forms, or dashboard/docs/default/auth structure.
metadata:
  short-description: Implement UI consistently
---

# DM Vault Style Guide

Use this skill when implementing or reviewing frontend changes.

## Source of truth

- Canonical guide: `theme-guide.md`
- Key implementation files:
  - `app/assets/css/main.css`
  - `app/app.config.ts`
  - `nuxt.config.ts`
  - `app.vue`
  - `app/layouts/*.vue`

If current code differs from the guide, treat the guide as intended architecture and implement with minimal regression risk.

## Workflow

1. Identify scope:
   - `theme/tokens`, `component styling`, `layout`, `navigation`, or `mixed`.
2. Read only relevant reference file(s):
   - Theme/tokens: `references/theme-and-tokens.md`
   - Components: `references/component-patterns.md`
   - Layout/navigation: `references/layouts-and-navigation.md`
   - Acceptance checks: `references/implementation-checks.md`
3. Implement with semantic tokens first:
   - Prefer `--ui-*` variables in global overrides and per-instance `:ui`.
   - Avoid hardcoded mode-specific hex/classes unless required for contrast.
4. Validate structure contracts:
   - `app.vue` remains minimal shell.
   - Layout responsibilities stay in layout files.
   - Dashboard owns `/campaign/**` routes.
5. Run checks:
   - `yarn typecheck`
   - `yarn lint`
   - targeted tests as needed.

## Non-negotiable rules

- Dark mode is default; light mode is parchment, not white.
- For internal nav, use `to` / `NuxtLink`, never bare `<a>`.
- Header nav can set manual `active` (prefix match); sidebar links rely on router active behavior.
- `UTabs` are for in-page state modes, not section-level app navigation.
- Dashboard sidebar uses collapsible behavior with `collapsed-size="0"` (fully hidden on collapse).
- Use unique dashboard panel storage keys: `dmvault-{view}-{role}`.
- Keep CSS `@import` ordering valid: all `@import` statements must be before other rules.

## Change strategy

- Prefer global fixes in `app/app.config.ts` and `app/assets/css/main.css` for repeated UI issues.
- Use per-instance `:ui` overrides only for true exceptions.
- Keep page components thin; extract repeated UI patterns into shared components.

