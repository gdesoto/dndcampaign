# Adopting the portable kit

The full reference application is bundled in `assets/example-app/`. Its `app/components/kit/` is the single source for portable components. See [example-app.md](example-app.md) for gallery inspiration and running/copying the complete app. Read selected component declarations before wiring them; source defines the bundled API, while the guide defines intended design behavior. Keep the accompanying MIT license when redistributing source.

## Copy sets

Paths below are relative to `assets/example-app/app/components/kit/`. Preserve sibling imports; use explicit imports or the host's auto-import naming convention.

| Composition | Copy together | Caller supplies |
| --- | --- | --- |
| PageHeader | PageHeader.vue | Dashboard context, title/count/breadcrumbs; actions and toolbar slots |
| ListItem | ListItem.vue, rowNavigation.ts | Router, identity/link, metadata/actions, selection/expansion models |
| DataTable | DataTable.vue, ListItem.vue, rowNavigation.ts, csv.ts | Native columns, string-id records, title/link callbacks, empty actions, persistence, focus fallback |
| ConfirmButton | ConfirmButton.vue | Consequence, async action, optional controlled model and focus fallback |
| ActionMenu | ActionMenu.vue, ConfirmButton.vue | Record name, optional link/action callbacks, deletion consequence and focus fallback |
| EntityForm | EntityForm.vue, EntityFormContainer.vue, ConfirmButton.vue | Router, writable draft, schema, explicit validity, persistence and completion handlers |
| DetailPanel | DetailPanel.vue | Title and ordered label/value facts; actions, named fact, default slots |
| StatCard | StatCard.vue | Label/value, optional subject icon/tone, real delta/progress or segments/max |
| InlineStatus | InlineStatus.vue | Status word and centrally mapped domain semantic color |

## Dependencies and configuration

Recorded baseline: Nuxt 4.5.2, Nuxt UI 4.11.0, Vue 3.5.42, Tailwind CSS 4.3.3, TanStack Vue Table 8.21.3, Lucide collection 1.2.129. These describe the snapshot, not universal minimums or a reason to change an existing host's versions. Check installed types/generated themes for compatibility. DataTable directly imports `@tanstack/vue-table`; router sets use `vue-router` through Nuxt. Schema libraries are caller-owned. Marked, demo stores, and identity switchers are needed by the full example, but unnecessary when adopting only kit components.

Enable `@nuxt/ui`, import Tailwind and Nuxt UI CSS, and provide `UApp` once around the existing layout/page composition. Preserve SSR, package manager, routing, and deployment choices. When integrating into an existing project, do not copy the example's `ssr: false` or entire config. Verify SSR/hydration when the host enables it: the reference app is a SPA.

Assets use `i-lucide-*` icons. Supply the collection and configure/verify client-bundle scanning if icons should ship locally. Dynamic icon names may need explicit inclusion; rendering alone does not prove local bundling.

Merge style roles into the host's theme; choose its own values:

| Layer | Integration |
| --- | --- |
| Tailwind `@theme` | `--text-data`, `--text-page-title`, `--text-metric`, matching line heights, and `--font-display`; copied classes reference these names |
| Layout tokens | Central page/touch sizing; reference names are `--spacing-page` and `--spacing-touch` |
| Runtime theme | Semantic shades in `:root`/`.dark`, `--ui-radius`; retain host palette |
| Shared Nuxt UI config | Small button/badge defaults, neutral ghost utilities, square icon centering, compact cells/card spacing |
| Shared touch behavior | At least 44px mobile/coarse-pointer controls, no overlapping checkbox hit areas; compact rows must not shrink targets |
| Shell/theme | Toaster placement/limits/duration, safe-area/mobile footer clearance, reduced-motion placeholders |

Reference defaults: data 0.8125rem, title 1.25rem, metric 1.5rem, desktop padding 1.25rem, touch 2.75rem. Preserve hierarchy rather than forcing these values. `font-display` may inherit the body face. Tokens must actually be referenced. See guide section 9; `.guide` CSS and alternate identity fonts are unnecessary.

## Source-specific contracts and gaps

- **Validity:** pass EntityForm `:valid="isValid"`, derived from the shared schema/requirements. Its optional Boolean prop is cast to false when omitted, disabling submission. The guide's abbreviated form snippet omits this necessary wiring.
- **Drafts:** supply a working copy. Use `serializeState` for meaningful fields JSON cannot represent. Page saves reset the dirty baseline and stay mounted; modal forms emit `update:open`. Navigate from `saved`, `deleted`, or `cancelled`, after persistence finishes. Reset/remount intentionally when switching records.
- **Delete:** requires edit mode, `showDelete=true`, and callable `deleteAction`. Supply truthful record-specific `deleteTitle`/`deleteDescription`; the default form description assumes permanent deletion. Cascading destruction still needs a modal.
- **Async:** persistence callbacks reject/throw on failure and resolve only on success. ConfirmButton/EntityForm own pending/error states. ActionMenu directly dispatches archive: the host supplies async errors, conflict protection, and real Undo when promised.
- **Focus:** supply `focusFallback` when a trigger or bulk toolbar can disappear. Destination/host owns focus after navigation or unmount; the example's heading helper is not required.
- **Table API:** exposes `tableApi` and `clear()`, native named cell slots, `expanded`, `actions-cell`, and card slots. Reserved IDs: `selection`, `expansion`, `actions`. `card-metadata` receives visible column ids. Do not assume arbitrary native props/models pass through just because cell slots do.
- **Remote data:** DataTable is a finite client-side composition. Its `loading` prop does not supply a complete remote-result/total/error contract. Add first-load/refresh/retry UI and adapt native manual options for server pagination/export. Do not fetch an entire database to fit it.
- **Filters:** current source uses a mobile slideover even though the guide prefers small filter sets inline. Choose deliberately; incidental source behavior does not override the design guideline.
- **Row clicks:** off by default, require `to`, and depend on rowNavigation.ts to protect controls, selected text, and modified clicks. Retain real identity links.
- **Orchestration:** query editors and Undo belong in the host. Example composables are bundled for study under `app/composables/`; in-memory status reversal is not production persistence. Preserve unrelated queries, namespace child editor keys, and distinguish pushed from directly loaded editor URLs.
- **Metrics:** current StatCard supports native UProgressGroup `segments`/`max` as well as `progress`; the example README's older summary omits these. Use real totals and reconciled distributions.

Study domain adapters and gallery pages for their composition and variety; adopt selected patterns into existing projects, or copy the full application when starting a new project. Check props, models, events, slots, imports, and async handlers in the selected source.
