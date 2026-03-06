# Component Patterns

## Scope

Use for Nuxt UI component styling and `:ui` usage patterns.

## Global-first approach

1. Set defaults in `app/app.config.ts` for repeated behavior.
2. Use per-instance `:ui` only for contextual exceptions.
3. Keep overrides semantic (`--ui-*`) and mode-safe.

## Priority components

- `UButton`: display font, uppercase, consistent size rhythm; keep clear variant semantics.
- `UBadge`: semantic color usage (`error` for alerts, `primary` for informational counts).
- `UCard`: primary container; ensure root/bg/border behavior is deliberate by variant.
- `UTabs`: in-panel mode switching; maintain active label readability and underline contract.
- `UInput`/`UTextarea`: consistent field base classes and focus ring treatment.
- `UTooltip`, `UKbd`, `USeparator`, `UTable`, `UAlert`: align to token system for contrast in both modes.

## Per-instance `:ui` patterns

- Use `:ui` component property for one-off visual exceptions:
  - taxonomy badges
  - row-level table states
  - component-specific micro accents
- Keep exceptions composable and minimal.
- Prefer token variables over hardcoded palette classes inside `:ui`.

## Tabs guidance

- Use `UTabs` for multiple content modes sharing the same page state.
- Do not use `UTabs` as replacement for top-level route navigation.
- Validate active tab readability in both dark and light mode.

## Card guidance

- Card alignment/padding issues usually come from global card slot overrides.
- If action groups stop aligning right globally, inspect card `header` slot classes first before patching pages one by one.

