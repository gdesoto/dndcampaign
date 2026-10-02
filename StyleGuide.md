# Frontend Style Guide

DM Vault component contracts and visual identity. Use `nuxt-ui-guidelines` for general interaction, layout, and accessibility; `AGENTS.md` for architecture and testing. Precedence: explicit user instruction, `nuxt-ui-guidelines`, this file. Read component source for full prop contracts.

## Existing building blocks

| Purpose | Use |
| --- | --- |
| Confirmation | `SharedConfirmActionPopover` by default; `SharedConfirmActionModal` when the confirmation needs a modal under the guidelines. Reuse these rather than inline confirms. |
| Modal forms | `SharedEntityFormModal` with real `state` and a validation `schema`; use its `deleteAction` for asynchronous deletion. |
| Persistent editors | `useUnsavedChanges` for navigation guards; `useEditorDraft` for merging refreshes into untouched fields. |
| Collection feedback | `SharedResourceState` with request `pending`, `hasData` for retained content, and `noMatches` / `clear` for filter recovery. |
| Retained data | `useRetainedResource`; overview requests use `useOverviewResource`. |
| Admin tables | `SharedResponsiveTable` for equivalent desktop and narrow-screen record actions. |
| Campaign headers | `CampaignPageHeader` for list/detail headers and detail back links. |
| Overview summaries | `SharedSummarySection` for independent section requests; `SharedStatCard` with `to` for metric destinations. |

## Integration constraints

- Confirmation `action` callbacks must reject on failure so the shared component owns error/retry feedback. Supply `focusFallback` when completion removes the trigger; the caller owns successful navigation.
- With `useEditorDraft`, capture submitted values before saving and accept that snapshot only after success. Saving one section must not erase another section's edits.
- Key `useRetainedResource` by exact resource/filter scope, use its `get` callback as the async-data default, and seed hydrated data. Unavailable overview counts must not render as zero.

## Campaign shell

- `app/app.vue` owns global providers and the media player; layouts own route chrome. Campaign routes use `dashboard`; admin routes use `admin`. Sidebars fully hide when collapsed (`collapsed-size="0"`); panel storage keys use `dmvault-{view}-{role}`.
- Campaign navigation keeps a section active for sibling detail routes and Sessions active for document/recording routes; Overview matches exactly. Keep developer tools development-only.
- Campaign overview keeps sessions, quests, and milestones in three equal desktop columns, with divided summary rows and a separate narrative surface for the campaign description.

## Visual identity

- Preserve the aged-manuscript appearance: gold accents, warm charcoal dark mode, parchment light mode, and restrained ornament. Keep Cinzel headings/navigation, Crimson Pro body copy, and JetBrains Mono for monospaced values. Preserve themed card frames/shimmer and the printed character sheet through `CharacterAbilityStat` and `sheet-compartment`.
- Reuse typography utilities: `type-title`, `type-section`, `type-record`, `type-label`, `type-metric`, and `reading-copy`. Exact theme values live in `app/assets/css/main.css`, component defaults in `app/app.config.ts`, and appearance preference in `nuxt.config.ts`.
