# Frontend Style Guide

Project-specific frontend contracts for DND Campaign (DM Vault). General interaction, layout, form, table, confirmation, feedback, and accessibility rules come from the `nuxt-ui-guidelines` skill and are not repeated here. Identity rules (palette, fonts, ornament) live in `theme-guide.md`. Precedence when they conflict: explicit user instruction, `nuxt-ui-guidelines`, this file, `theme-guide.md`. Architecture, naming, and commands are in `AGENTS.md`.

## Shared components and their contracts

### Confirmation
- `SharedConfirmActionPopover` is the default for irreversible actions. Use `SharedConfirmActionModal` only when the confirmation must carry a count, a cascade, or a pending state the reader has to watch. Never use inline `UPopover` confirms or `window.confirm`.
- Customize through props (`message`, trigger label/icon/color/variant/size, confirm/cancel labels/colors/sizes, loading). Icon-only triggers set `triggerAriaLabel` and `:triggerShowLabel="false"`.
- Destructive triggers stay neutral; the error color goes on the final commit button. Name the affected record and the irreversible consequence.
- Prefer the async `action` prop. Reject on failure so the prompt keeps its error and retry controls. Supply `focusFallback` when completion removes the trigger.
- Use the entity modal's `deleteAction` for asynchronous deletion so failures stay in the confirmation; the caller owns successful completion and navigation. `recordName` and `deleteMessage` can describe scope beyond the form's title.

### Forms and drafts
- Pass real `state` and a validation `schema` to `SharedEntityFormModal`. The modal protects changed drafts and blocks dismissal during submission.
- Use `useUnsavedChanges` for persistent editors. Keep saved baselines separate from local drafts; saving one section must not erase another section's edits.
- Use `useEditorDraft` to merge server refreshes into untouched fields. Capture submitted values before saving and accept that snapshot only after success. Preserve record identity through polling, pagination, and map edits; confirm before replacing a dirty editor with another record.
- Serialize conflicting saves, restores, imports, and deletes. Preserve user input after failure.

### Collection state
- Give `SharedResourceState` the actual request pending state and `hasData` when useful content exists. Refreshes and refresh failures retain that content.
- When request errors clear Nuxt async data, use `useRetainedResource` with an exact resource/filter key and its `get` callback as the async-data default. Seed hydrated data and never reuse another scope's results after a failed request. Overview pages use `useOverviewResource`; unavailable counts must not render as zero.
- Distinguish an empty collection from filtered no-matches; use `noMatches` and `clear` for filter recovery.
- Use `SharedResponsiveTable` for admin records that need equivalent desktop and narrow-screen actions. Paginate against the server total and reset the page when filters change.

### Page shells and navigation
- Campaign list/detail templates share `CampaignPageHeader`: one title, optional neutral result count, wrapping trailing actions. Pass counts only when data is available; use server totals for paginated collections. Detail back links belong in the header.
- Sidebar links use native router activation with exact Overview matching. The campaign shell keeps a section active for its sibling detail routes (Nuxt index routes are not their matched ancestors) and keeps Sessions active for document and recording routes.
- Dashboard content scrolls in `UDashboardPanel`'s native body slot; navbar and breadcrumbs go in its header slot. Do not add a full-height scroller under fixed-height chrome.
- Admin routes use the dedicated `admin` layout: grouped route navigation, fully collapsible sidebar, persistent breadcrumbs and account/appearance controls. Keep its panel storage keys separate from campaign panels (`dmvault-{view}-{role}`). Developer tools stay development-only.
- Overview summaries use `SharedSummarySection` (heading, drill-in link, independent request state) with divided list rows rather than nested cards. Metric destinations use `SharedStatCard`'s `to` prop. Keep sessions, quests, and milestones in three equal desktop columns; give the campaign description its own narrative surface.
- Story status is readable before editing. Preserve its draft across refreshes, disable unchanged saves, and return focus to Edit after cancel or completion.

## DM Vault identity in code
- Preserve Cinzel headings, Crimson Pro body copy, parchment light mode, and character-sheet ornament. Dark mode is the default.
- Type roles: `type-title` for page titles, `type-section` for section headings, `type-record` for record names, `type-label` for short engraved labels, `type-metric` for key values, `reading-copy` for narrative passages. The scale lives in `main.css`. Labels and metadata are at least 12px; short uppercase labels get restrained 0.08em tracking; comparable values use tabular figures.
- Main content uses the default outlined `UCard` with the themed frame and the restrained `dmvault-card` top shimmer. Supporting panels (filters, metrics, tools) and nested cards use `variant="soft"`, `subtle` when they need a boundary. Reserve shadows for overlays. Static containers do not brighten their whole border on hover. Preserve reduced-motion support.
- Character stat boxes keep a printed-sheet structure: label, prominent score, framed modifier. Use `CharacterAbilityStat` and `sheet-compartment`; the outer sheet and section dividers carry the stronger decoration.
- Buttons default to neutral outline; one primary solid action per context. Badges are neutral unless they convey a semantic status. Ordinary totals stay neutral; semantic metric colors mark a meaningful outcome or exception with explanatory text.

## Testing expectations
- Add or update `test/nuxt` coverage for meaningful component or composable behavior changes, and `test/e2e` coverage for critical flows.
- Test loading, empty, no-matches, validation failure, and API error states.
- Test behavior, not implementation internals.
