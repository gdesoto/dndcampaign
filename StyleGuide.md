# Frontend Style Guide

This guide defines how frontend code should be built in the DND Campaign app.

## Scope
- Applies to all frontend code in `app/` and shared UI code used by pages/components.
- Use this guide alongside `AGENTS.md` and project plans in `dev_plan/`.

## Core Principles
- Build with Nuxt 4 and TypeScript-first patterns.
- Prefer consistency and maintainability over one-off implementation shortcuts.
- Favor Nuxt UI primitives before custom components.
- Keep pages composable, predictable, and easy to test.
- Fix root causes rather than adding fragile UI workarounds.

## Project Structure
- `app/pages`: route-level page components only.
- `app/components`: reusable presentational and feature components.
- `app/composables`: reusable stateful logic and view-model helpers.
- `app/layouts`: app-level layout shells.
- `app/app.config.ts`: Nuxt UI theme and component configuration overrides.

Guidelines:
- Keep pages thin; move repeated UI logic into components/composables.
- Co-locate tightly related feature UI within a clear folder structure.
- Use clear, domain-driven names (for example, `CampaignSessionTimeline.vue`).

## Component Development Standards
- Use Nuxt UI components as defaults (`UPage`, `UPageHeader`, `UMain`, `UCard`, `UForm`, `UButton`, etc.).
- Build small, single-purpose components with explicit props and emits.
- Prefer `script setup lang="ts"` with strongly typed props and events.
- Avoid overly large components; split when responsibilities diverge.
- Do not mutate props directly; derive local state through refs/computed values.

### Props and Events
- Type all props and emitted events explicitly.
- Keep prop APIs minimal and stable.
- Use event names that describe user intent (for example, `save`, `cancel`, `select-session`).

### Slots
- Prefer slots for extensibility when parent views need layout control.
- Document non-obvious slot contracts with brief comments near usage.
- For `UTable` customization, prefer `#<column>-header` and `#<column>-cell` slots for simple UI composition (links/buttons/badges) instead of render-function definitions unless dynamic render logic is truly needed.

## Nuxt UI and Theming
- Centralize theme overrides in `app/app.config.ts`.
- Only use documented Nuxt UI config keys (`defaultVariants`, `slots`, `variants`, `compoundVariants`, etc.).
- Verify component config key names before introducing new `ui.*` overrides.
- Prefer design tokens/semantic classes over repeated one-off utility combinations.

## Styling and Tailwind
- Use Tailwind utility classes consistently and keep class ordering readable.
- Prefer shared patterns over copy-pasted class strings.
- Avoid inline styles unless required for dynamic one-off values.
- Keep spacing, typography, and color usage consistent across similar UI patterns.
- Preserve responsive behavior across common breakpoints (`sm`, `md`, `lg`, `xl`).

## State and Data Flow
- Use composables for reusable client-side logic and state orchestration.
- Keep server communication in explicit API calls; avoid hidden side effects in UI components.
- Use `useAsyncData`/`useFetch` patterns consistently for page-level data loading.
- Handle loading, empty, and error states explicitly in UI.
- Prefer derived state (`computed`) instead of duplicating source-of-truth data.

## Forms and Validation
- Use Nuxt UI form primitives for consistent behavior and styling.
- Keep form models typed and validation rules explicit.
- Show actionable validation messages near related fields.
- Prevent double-submit states during async form actions.

## Accessibility and UX
- Use semantic HTML and accessible Nuxt UI primitives by default.
- Ensure all interactive controls are keyboard reachable.
- Provide labels/aria text for icon-only buttons and ambiguous controls.
- Maintain visible focus states and adequate color contrast.
- Provide clear feedback for async actions (loading indicators, success/error states).

## Performance Guidelines
- Lazy-load heavy or route-specific components when appropriate.
- Avoid unnecessary reactive watchers and deeply nested reactive objects.
- Use `computed` for expensive derived values and cache where practical.
- Keep bundle growth in check by preferring existing dependencies and shared components.

## Error Handling
- Show user-friendly error states in pages and critical components.
- Log useful diagnostic information without exposing sensitive details.
- Avoid silent failures; failures should be visible and actionable.

## Testing Expectations
- Add or update unit tests for meaningful component/composable behavior changes.
- Add/maintain e2e coverage for critical user flows.
- Test edge states: loading, empty results, validation failures, and API errors.
- Keep tests focused on behavior rather than implementation internals.

## Code Review Checklist (Frontend)
- Uses Nuxt UI primitives where appropriate.
- Keeps page components thin and composables reusable.
- Has explicit types for props/events/API payloads.
- Includes loading/empty/error states.
- Preserves accessibility and keyboard interactions.
- Maintains responsive layout behavior.
- Adds or updates tests for changed behavior.
- Avoids undocumented theme/config keys in `app/app.config.ts`.
