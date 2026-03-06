# Theme And Tokens

## Scope

Use for:
- `app/assets/css/main.css` token changes
- `app/app.config.ts` styling that should be mode-safe
- color mode behavior and semantic role mapping

## Core model

1. `@theme` defines reusable color scales and fonts.
2. `:root` defines default semantic UI tokens (baseline is dark colorMode).
3. `.light` overrides semantic tokens for parchment mode.
4. Components should consume semantic tokens (`--ui-*`) through global Nuxt UI config and utility classes.

## Token intent

- Background ladder:
  - `--ui-bg`: page base
  - `--ui-bg-elevated`: cards/panels
  - `--ui-bg-accented`: controls/hover fills
  - `--ui-bg-muted`: subtle surfaces
- Border ladder:
  - `--ui-border`: default
  - `--ui-border-accented`: focus/active
  - `--ui-border-muted`: lowest-emphasis dividers
- Text ladder:
  - `--ui-text`: primary body text
  - `--ui-text-muted`: secondary copy
  - `--ui-text-dimmed`: placeholders/disabled
  - `--ui-text-highlighted`: strongest emphasis
- Brand:
  - `--ui-primary` points to appropriate primary shade per mode.

## Nuxt UI theming principles

- In `app.config.ts`, prefer token references:
  - `bg-[var(--ui-bg-elevated)]`
  - `border-[var(--ui-border)]`
  - `text-[var(--ui-text-muted)]`
- Only use `dark:` when opacity-based/shared token usage cannot satisfy contrast requirements.
- Avoid `bg-white`, `text-black`, or other mode-breaking absolutes in thematic UI.

## Practical guardrails

- If cards appear to use `--ui-bg` instead of `--ui-bg-elevated`, inspect `UCard` variant classes in global config (e.g., `outline` variant may add `bg-default`).
- Keep font imports at top of CSS before non-import rules to avoid PostCSS warnings.
- Keep color mode defaults and persistence in `nuxt.config.ts` aligned with product intent.

