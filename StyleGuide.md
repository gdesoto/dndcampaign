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
- Use Nuxt UI components as defaults (`UPage`, `UPageHeader`, `UTabs`, `UCard`, `UForm`, `UButton`, etc.).
- Build small, single-purpose components with explicit props and emits.
- Prefer `script setup lang="ts"` with strongly typed props and events.
- Avoid overly large components; split when responsibilities diverge.
- Do not mutate props directly; derive local state through refs/computed values.

### Shared Confirmation Pattern
- Use `app/components/shared/ConfirmActionPopover.vue` for destructive-action confirmations before creating inline `UPopover` confirms or using `window.confirm`.
- Prefer component props to customize trigger and confirmation behavior (`message`, trigger label/icon/color/variant/size, confirm/cancel labels/colors/sizes, and loading states).
- For icon-only triggers, set `triggerAriaLabel` and `:triggerShowLabel="false"` for accessibility and consistent behavior.
- Keep destructive triggers neutral; use error color for the final destructive commit. Describe the affected record and irreversible consequence.
- Prefer the async `action` prop for new callers. Reject on failure so the prompt retains its error and retry controls. Supply `focusFallback` when completion removes the trigger and there is a better destination than the page heading.

### Forms and Collection State
- Pass real `state` and a validation `schema` to `SharedEntityFormModal`. The modal protects changed drafts and prevents dismissal during submission.
- Use `useUnsavedChanges` for persistent editors. Keep saved baselines separate from local drafts; a refresh after saving one section must not erase another section's edits.
- Use `useEditorDraft` to merge server refreshes into untouched fields. Capture submitted values before saving and accept that snapshot only after success. Preserve record identity through polling, pagination, and map edits; explicitly confirm before replacing a dirty editor with another record.
- Serialize conflicting saves, restores, imports, and deletes. Preserve user input after failure.
- Give `SharedResourceState` the actual request pending state and `hasData` when useful content exists. Refreshes and refresh failures should retain that content.
- When request errors clear Nuxt async data, use `useRetainedResource` with an exact resource/filter key and its `get` callback as the async-data default. Seed hydrated data and never reuse another scope's results after a failed request.
- Distinguish an empty collection from filtered no matches; use `noMatches` and `clear` for filter recovery.
- Use `SharedResponsiveTable` for admin records requiring equivalent desktop and narrow-screen actions. Paginate against the server total, and reset the page when filters change.
- Use native navigation links for route sections. Keep entity headers in persistent parent routes and use exact matching for Overview.
- Dashboard content scrolls in `UDashboardPanel`'s native body slot; keep navbar and breadcrumbs in its header slot. Do not add a full-height scroller beneath fixed-height chrome.
- Sidebar links use native router activation with exact Overview matching. The campaign shell explicitly keeps a section active for its sibling detail routes (Nuxt index routes are not their matched ancestors), and keeps Sessions active for document/recording routes.
- Campaign list/detail templates share `CampaignPageHeader`: one title, optional neutral result count, and wrapping trailing actions. Pass counts only when data is available; use server totals for paginated collections. Detail back links belong in the header by default.
- Use the shared entity modal's `deleteAction` callback for asynchronous deletion so failures stay in the confirmation. Reject on failure; the caller owns successful completion and navigation. `recordName` and `deleteMessage` can describe scope beyond the form's name/title.
- Read-only notices are neutral context. Ordinary totals stay neutral; use semantic metric colors only for a meaningful outcome or exception, with explanatory text.
- Overview summaries use `SharedSummarySection` for a heading, drill-in link, and independent request states. Prefer divided list rows inside it over nested record cards. Metric destinations use `SharedStatCard`'s `to` prop.
- Keep the overview's sessions, quests, and milestones in three equal desktop columns regardless of current item counts, with consistent header placement. Preserve the activity timeline and give the campaign description a distinct narrative surface. Familiar edit controls may be icon-only with accessible names and tooltips; omit routine page refresh actions when saves already refresh affected data.
- Story status is readable before editing. Preserve its draft across refreshes and unrelated saves, disable unchanged saves, and return focus to Edit after cancellation or completion. Use `useOverviewResource` for overview data with scope-specific retained results; unavailable counts must not appear as zero.

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
- Buttons default to neutral outline. Explicitly use primary solid for the main save/create action; use neutral ghost or outline for supporting controls. Badges default to neutral unless they convey a semantic status.
- Decoration, character, and design whimsy are welcome throughout DM Vault. Main cards retain elevated backgrounds, themed frames, and the restrained `dmvault-card` top shimmer; supporting surfaces remain quieter. Preserve reduced-motion support and readable content when adding decorative effects.

## Styling and Tailwind

### Typography and surface roles
- Preserve Cinzel headings, Crimson Pro body copy, parchment, and character-sheet ornament.
- Use `type-title` for page titles, `type-section` for section headings, `type-record` for record names, `type-label` for short engraved labels, and `type-metric` for key values. Their relative-unit scale lives in `main.css`.
- Use `reading-copy` for narrative passages. Essential labels and metadata must be at least 12px; use restrained 0.08em tracking on short uppercase labels and tabular figures for comparable values.
- Main content uses the default outlined `UCard`, with the themed frame and restrained top shimmer. Supporting panels (filters, metrics, tools) and nested cards use native `variant="soft"`; use `subtle` when a supporting panel needs a boundary. Reserve shadows for overlays.
- Separate internal content with spacing or dividers before adding another card. Static containers do not brighten their entire border on hover.
- Character stat boxes deliberately retain a printed-sheet structure: label, prominent score, framed modifier. Use `CharacterAbilityStat` for compact and full displays and `sheet-compartment` for matching inset combat fields. The outer sheet and ornamental section dividers carry the stronger decoration.

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

## Server API Preferences
- Prefer resource-first, namespace paths over compound segments:
  - Use `/api/campaigns/:campaignId/journal/entries` instead of `/api/campaigns/:campaignId/journal-entries`.
- For single-model attribute updates, use `PUT`/`PATCH` on the canonical model endpoint with model attributes:
  - Example: update encounter `name`/`type`/`visibility` via `PUT` or `PATCH` on `/api/encounters/:encounterId`.
- For controlled state transitions or business operations, use typed action payloads on canonical endpoints where practical:
  - Example: `PATCH /api/encounters/:encounterId` with `{ action: 'start' | 'pause' | ... }`.
- Prefer endpoint reuse and consolidation over narrow one-off endpoints:
  - Example: use a shared HP adjustment operation payload rather than separate `/apply-damage` and `/apply-heal` routes.
- If an operation must safely coordinate changes across multiple models, a dedicated action endpoint is acceptable.
- For payload-shape changes, add/expand tests before refactor and re-validate after refactor.
- Any API route or payload change must be updated in the OpenAPI spec (`public/openapi.json`) in the same change set.

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
