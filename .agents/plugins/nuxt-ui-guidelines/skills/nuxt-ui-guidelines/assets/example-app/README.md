> Bundled reference source: gallery, application examples, and fictional data are retained. Dependencies, Git history, caches, build output, and historical verification artifacts are excluded. Run the installation commands below in a working copy.

# Fieldwork · Nuxt UI reference

A Nuxt 4 SPA implementing the [portable guidelines](../../references/guidelines.md). Start with the guide, then explore working courses, game planning, and annotated components.

## Run locally

Requires Node 22.16+ (verified with Node 24.19.0) and pnpm 12.3.4.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000. Data is fictional and kept in memory; refreshing restores the fixtures. Theme and sidebar preferences may persist locally. No accounts or backend setup are needed; the first font-enabled build needs network access.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm preview
```

This is a client-rendered application (`ssr: false`). A production static host must rewrite unknown application paths to the SPA entry document. The included Nuxt preview server supports direct routes. Public Sans and JetBrains Mono are downloaded by native Nuxt Fonts at build time and served locally; system fallbacks remain available. Lucide icons are bundled locally: `icon.clientBundle.scan` in `nuxt.config.ts` scans source for icon names so every referenced icon ships in the client bundle. Without that setting only Nuxt UI's own icons are bundled and the rest are fetched from the public Iconify API at runtime, which still renders and is easy to miss.

## Project map

- `app/components/kit/`: ten portable compositions and supporting utilities.
- `app/components/demo/`: course/session field components and application actions.
- `app/composables/useDemo.ts`: fictional session-only data.
- `app/pages/courses/`: index and persistent detail parent with Overview/Students children.
- `app/pages/planning/`: game session cards, table, detail, and shared modal editing.
- `app/pages/gallery/`: live examples, contracts, recipes, and error states.
- `app/pages/gallery/api.vue`: searchable `/gallery/api` reference for all 15 custom components, linked from both gallery navigation menus.
- `app/data/componentApi.ts`: source-reviewed props/defaults/options, events, slots, exposed methods, behavior notes, and copyable SFC examples. Update this catalog when component contracts change.
- `app/pages/guide.vue`: imports the canonical `../../references/guidelines.md` (relative to the app root). Keep the skill folder structure when running the bundled app. To extract the app alone, copy that guide to the app root as `GUIDELINES.md`, change the page import to `../../GUIDELINES.md?raw`, and remove the external-guide `vite.server.fs.allow` configuration.
- `output/`: generated verification artifacts; not application source.

## Copy components into another Nuxt 4 / Nuxt UI 4 application

1. Enable `@nuxt/ui`, import `tailwindcss` and `@nuxt/ui` in your CSS, and wrap the root in `UApp`.
2. Copy the selected component files listed below into your component directory. Preserve relative sibling imports. Import the component explicitly where used, or follow the host's auto-import naming convention.
3. Merge semantic color/default settings from `app/app.config.ts` and tokens from `app/assets/css/main.css` into your existing theme. The `.guide` styles are documentation-only.
4. Supply your own data, callbacks, and routes. No kit component imports `useDemo` or assumes a domain.
5. Keep the installed Nuxt UI version compatible with the lockfile baseline and recheck generated slot definitions when upgrading.

| Copy set | Additional dependencies |
| --- | --- |
| ConfirmButton.vue | Nuxt UI Button, Popover, Tooltip, Alert |
| EntityForm.vue + EntityFormContainer.vue + ConfirmButton.vue | Vue Router; native Modal, Form, Button, Popover, Tooltip, Alert; caller supplies schema and callbacks |
| ListItem.vue | Nuxt UI Checkbox, Button; NuxtLink |
| PageHeader.vue | Native dashboard shell in host layout; Breadcrumb |
| DataTable.vue + ListItem.vue + csv.ts | `@tanstack/vue-table@8.21.3`; native Nuxt UI table/controls and Modal |
| ActionMenu.vue + ConfirmButton.vue | Nuxt UI DropdownMenu and Button; callbacks provided by the host |
| DetailPanel.vue | Nuxt UI Card; semantic definition list |
| StatCard.vue | Nuxt UI Card and Progress |
| InlineStatus.vue | Nuxt UI Badge |

### Public contracts

The [protected editor pattern](docs/form-pattern.md) documents this optional implementation. Choose it when potential loss of meaningful input warrants its guards; simpler or recoverable edits may use native UForm or a host composition.

**EntityForm presentation/deletion:** `presentation` is `modal` (default) or `page`; `open` is optional for page forms. Page presentation shares the same form body without an overlay or repeated heading. The host handles `cancelled`/`deleted` for navigation or an empty state; `saved` keeps page forms mounted and resets their dirty baseline. Copy `EntityFormContainer.vue` and `ConfirmButton.vue` alongside `EntityForm.vue`. Both presentations need Vue Router for dirty navigation guards.

Deletion is opt-in: `showDelete: true` **and** `deleteAction: () => unknown | Promise<unknown>` must be supplied, and mode must be `edit`. `deleteTitle` and `deleteDescription` customize the prompt/consequence. The tooltip-labeled icon sits left of Cancel/Save. Failures stay in the popover; pending deletion blocks conflicting actions. Callbacks perform persistence; navigate from `saved`/`deleted`/`cancelled`, not inside a pending callback. After unmount, the host owns focus placement. The live page example is `/gallery/forms`; modal examples are under `/gallery/components`.

**ConfirmButton** takes `title`, `description`, and `action: () => unknown | Promise<unknown>`. Optional `tooltip`, `icon`, `label`, `confirmLabel`, `tone: error | primary`, `disabled`, and controlled `modelValue` customize behavior. Emits `completed` and `update:modelValue`. Resolve the callback only on success; throw/reject on failure. The default trigger is icon-only; confirmation buttons are labeled.

**EntityForm** takes `title`, `mode: create | edit`, a writable `state` object, supported `schema`, and async-capable `save`, plus `open` for modal presentation. Optional `valid` controls valid-state disabling and `submitLabel` supplies contextual creation labels. Emits `update:open`, `saved`, `cancelled`, and `deleted`. The default slot receives `pending` and contains the entity's fields. The caller owns the working copy and persistence. Dirty cancellation and router navigation require Discard or Keep editing. Supply a Vue Router context (Nuxt provides it). Presentation/deletion options are described above.

**ListItem** takes `title`, optional `description` and `to`, `variant: row | card` (row by default), `selectable/selected`, and `expandable/expanded`. Emits corresponding model updates. Slots: `leading`, `metadata`, `actions`, `expanded`. Do not wrap the whole item in a link containing its buttons.

**PageHeader** takes `title`, optional `count`, and native `BreadcrumbItem[]`. Slots: `actions` and default toolbar content. Place inside a UDashboardPanel header under the dashboard layout.

**DataTable<T extends { id: string }>** takes `data`, native `TableColumn<T>[]`, and `title(item)`. Optional `to(item)`, `description(item)`, `archive(items)`, `remove(items)`, `filename`, `loading`, `view`, `emptyTitle`, `emptyDescription`, `emptyActions`, and `focusFallback`. Native named cell slots and `expanded` pass through; `actions-cell` also renders on cards, while `card-metadata` and `card-leading` customize the card layout and `empty` replaces the resolved empty state. Reserved column IDs: selection, expansion, actions. Exposes `tableApi` and `clear()`. Columns use native filter functions and accessors; numeric example columns deliberately use text matching for their toolbar filter.

The wrapper is optimized for finite client-side collections. For a production server-paginated collection, adapt the native manual options and remote result/count contract rather than fetching all records merely to use this demo. CSV export quotes values, neutralizes spreadsheet formulas, excludes control columns, and exports visible data columns across filtered pages or explicitly selected rows.

## Design choices

Visual contrast is carried by signals rather than decoration — a signal varies with something real, either per record or per type: supporting panels and metric cards use the soft card variant so content cards read as primary; a semantic leading border marks a card holding an exception, alongside its status word; labeled buttons take a leading icon when the label names a stable concept or a destination; avatars appear wherever a person is named, including instructors; and mono marks machine-formatted values such as schedules and seat ratios, never titles or prose.

The agreed defaults now include labels above fields; Cancel before Submit with wider mobile buttons; small subtle status badges; content-sized status columns; always-visible quiet actions; bottom-right desktop/bottom-center mobile toasts; adaptive inline filters; and canonical field order with wrapping rather than responsive reordering. Thin wrappers are justified by shared defaults or wiring, not by a fixed component count.

`DataTable` and `ListItem` accept optional `rowClickable` (false by default) alongside `to`. It enables a noninteractive row-click shortcut while keeping identity links and protecting controls, selected text, and modified clicks. Copy `rowNavigation.ts` with either component and provide Vue Router (included by Nuxt). The component gallery has a live opt-in toggle. Catalog pages retain link-only navigation. The existing small filter set stays inline; use a native slideover if a host adds a larger set.

Courses now groups Catalog, Sections (`/courses/sections`), and Requests (`/courses/requests`). Sections support creation, editing, capacity indicators and guarded publication. Requests support capacity/prerequisite-aware approval and confirmed decline; approval updates the course roster and section occupancy. Course detail includes Overview, Students, and Assessments child routes with shared create/edit assessment fields and total-weight validation. All fixtures reset on refresh.

These domain examples live in `components/demo`, `composables/useAcademics.ts`, and `utils/academicRules.ts`; they are not dependencies of the portable kit. Native UCard, UProgress, UAccordion, UTable, forms, navigation and overlays supply the interaction primitives. The application owns the academic rules. Assessment editors use namespaced route query keys to remain independent of the parent course editor.

The external reference folder is not bundled; its reconciled guidance is in `../../references/guidelines.md`. Its visual rules inform this revision, not its custom runtime. Shared defaults now use blue/slate, 36px desktop table rows, 13px data, aligned numbers, and quiet row menus. Touch targets remain 44px. Header, detail, card/list recipes and gallery annotations follow the external hierarchy.

Archive uses a native toast with working Undo via the application-level `useArchive` composable; it dismisses its own notification by id and never clears the toaster, which would evict another record's Undo or an unread error. Bulk deletion uses UModal; single-record deletion uses UPopover. `useQueryEditor` composes Nuxt's router for `?new=1`, `?edit=id`, and `?duplicate=id`. New records defer relationship selection until Edit. These composables are optional application orchestration, not hidden dependencies of the kit.

**DetailPanel** takes `title` and `facts: { label, value }[]`; slots are `actions`, default content, and a named slot per fact label. **StatCard** takes `label`, `value`, optional `icon`, `tone`, `delta` and `progress` (0–100), plus a supporting-content slot. A StatCard icon names the metric's subject and is applied to a whole row or none of it; `tone` colors the icon and value only while the metric is genuinely an exception. **InlineStatus** takes `label` and a semantic `color`. **ActionMenu** takes `name`, optional `to`/`archived`, and edit/duplicate/archive/remove callbacks. Archive must provide real reversal when presenting Undo.

Use UEmpty, UAccordion and UProgress directly. Filters and bulk controls remain within DataTable; no extra wrapper is needed just to match the external reference's component count. External-only filtering/mobile redesigns were not part of this selected visual pass.

The `card-metadata` slot also receives `visibleColumns: string[]`; use it to respect column visibility while retaining the record identity. Expansion and action columns appear only when their corresponding slots are supplied.

`emptyIcon` names the thing that is missing on a resolved empty collection; the no-matches state uses a search icon of its own.

`view` selects the presentation of one row model: `"table"` (default) shows the table at `md` and above with cards below it, and `"cards"` uses the card grid at every width. Both share the same search, filters, sorting, selection, pagination and export, so a view toggle never removes an operation. The empty state is resolved by the wrapper rather than forwarded: a genuinely empty collection shows `emptyTitle`/`emptyDescription` with the host's `emptyActions` for creation, while a filtered-out collection offers Clear filters. `focusFallback` names the control that receives focus after a bulk action, whose selection toolbar unmounts along with the selection it acted on.

The selected toolkit uses supported semantic variants; it does not replicate the entire upstream catalog. The component gallery links to native documentation for additional options. The application shell itself demonstrates dashboard components and nested navigation. The gallery explains decisions; example pages keep prose concise.

Source files for complete recipes are in `app/pages/gallery/recipes.vue`; inline snippets show the relevant composition and state dependencies. Complete reusable implementations live in `app/components/kit`.

## Provenance and versions

Based on [nuxt-ui-templates/dashboard](https://github.com/nuxt-ui-templates/dashboard), commit `7f62b754af4c9e34aa7521ed44371ac95332c8cc`. The original MIT license is retained. Template-specific inbox, customer, chart, and server fixtures were removed from this new clone; they remain recoverable in its Git baseline.

Verified baseline: Nuxt 4.5.2, Nuxt UI 4.11.0, Vue 3.5.42, Tailwind CSS 4.3.3, TanStack Vue Table 8.21.3, Zod 4.5.4, Marked 17.0.6. Exact transitive versions are in pnpm-lock.yaml. Historical verification artifacts are not bundled; run the checks above in your copied application.

### Portability options

- `ActionMenu` actions (`edit`, `duplicate`, `archive`, `remove`) are optional. Omitted actions and empty groups are hidden; without any action or link, no menu is rendered. Pass `deleteDescription` to explain the caller's deletion consequences.
- `DataTable.deleteDescription` supplies bulk deletion consequences. Both wrappers default to a neutral confirmation question without promising permanent deletion.
- `ConfirmButton`, `ActionMenu`, and `EntityForm` accept `focusFallback: () => void`. The host chooses the fallback target when a trigger is removed; the kit never searches for a page heading. The demo passes its application-owned `focusDemoHeading` helper. When navigation unmounts a component, the destination still owns focus. `ActionMenu` restores its menu trigger after confirmation; its nested confirmation also receives the host fallback for removal of the whole menu.
- `EntityForm.serializeState(state)` optionally returns a stable string representing meaningful field values. It replaces JSON serialization for every baseline capture and dirty comparison, including opening, saving, deleting, and discarding. For example, a file form can include its file's name, size, and lastModified; a map form can serialize its entries. Include every value whose changes should count. The component defaults to `JSON.stringify(state)` when this optional prop is omitted. Override it with `:serialize-state="serializeState"` only when the form needs custom serialization.
- Copy `rowNavigation.ts` alongside `ListItem.vue` and `DataTable.vue`; it is their shared row-interaction utility.
