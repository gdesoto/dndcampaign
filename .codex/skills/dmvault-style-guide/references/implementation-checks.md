# Implementation Checks

## Pre-change checklist

- Confirm target scope:
  - theme/token update
  - component global override
  - layout/nav shell change
- Identify whether fix should be global (`app.config.ts` / `main.css`) or local (`:ui` on one instance).
- Confirm affected routes and layouts.

## During change

- Keep semantic token usage (`--ui-*`) for mode-safe behavior.
- Preserve existing route structure and layout ownership.
- Keep page components thin; extract repeated UI patterns when possible.

## Validation checklist

- Visual:
  - dark mode contrast: body text, muted text, active tabs, nav labels
  - light mode contrast: borders, placeholders, badges
  - mobile dashboard navigation remains reachable
- Behavior:
  - sidebar collapse/responsive behavior works
  - breadcrumbs and navbar context are correct for nested routes
  - no duplicate page header chrome after layout changes
- Technical:
  - CSS import ordering has no PostCSS warnings
  - `yarn typecheck` passes
  - `yarn lint` passes

## Regression hotspots

- `UCard` variant + slot class interactions
- `UTabs` active trigger text and spacing
- dashboard shell heights when adding global header/nav wrappers
- modal height/scroll behavior in long forms

