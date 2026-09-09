# Verification

## Color roles, confirmation containers, and shell chrome — 2026-09-09

Four changes prompted by comparing this guide against a host project that had adopted it and diverged.

- **Color contract (§4).** New table naming what primary, neutral, error, warning, success, info and secondary each claim, with neutral as the default — including for a destructive *trigger*, whose color belongs on the confirmation's commit button rather than on every trash icon in a list. One deliberate exception is written down: a decision pair (approve/decline, accept/reject, publish/withdraw) may carry `success` and `error` at the point of commitment, because opposite outcomes rendered as identical grey icons are worse. The enrollment queue now demonstrates it, and `ConfirmButton` gained `triggerColor` (default `neutral`) so the exception is opt-in rather than a fork.
- **Confirmation containers (§5).** The rule was written as single-record → popover, bulk/cascading → modal, which read as a fixed list of action names. It now selects on what the reader must be shown: reversible actions confirm nothing, a consequence that fits in a sentence uses the popover (the common case), and the modal is for a count, an enumerated cascade, a typed acknowledgement, or a watched pending state. One record that silently removes ten related ones earns a modal; two independent records do not. The bulk modal in `DataTable` also had its consequence sentence stranded in the header with an empty body — the sentence now renders in the body, where the reader looks.
- **Color mode (§9).** The guide required light, dark and system but never named a default, which is how a host lands on a fixed default without contradicting anything. System is now the default where the platform reports one, a fixed default stays permitted for a host that deliberately owns its look, and the SSR trap is recorded: a control rendering *from* `colorMode.preference` needs `ClientOnly` with a stable fallback, and `system` is the value that exposes the hydration mismatch.
- **Shell chrome (§8).** The sidebar footer now carries appearance and account in that order — identity select and an icon-only appearance menu of System/Light/Dark on one row, an account menu beneath — replacing the version-string filler and the two-state color toggle that silently dropped system preference. Horizontal `UNavigationMenu` section strips turn on native `highlight`, so the active child route carries a moving underline rather than a color change alone.

Checks: `eslint app` (zero errors/warnings), `nuxt typecheck`, five tests, and a production build passed. `references/guidelines.md` and the eight changed app files are byte-identical to their `example-app/` originals in the plugin snapshot; `pages/guide.vue` keeps its deliberate import-path difference.

**Not verified:** no browser pass. The app is `ssr: false` and Playwright is not installed here, so the rendered results of these changes — the footer's account button at both sidebar widths and in the collapsed rail, the appearance menu's `ClientOnly` fallback, the underline indicator, the bulk modal's rebalanced body, and the success/error decision pair against both themes — still need the browser review the earlier entries describe. The `ClientOnly` guidance in particular is written for SSR hosts and cannot be exercised by this SPA build.

## Guidelines, not a skin — 2026-09-08

Reframed the document so a host keeps its own identity. Every statement now sits at one of three levels: **Fixed** (never traded away — keyboard reachability, accessible names, status never carried by color alone, confirmation matched to risk, distinct resolved states), **Default** (sound starting points, deviate deliberately and record it centrally), and **Yours** (palette, typefaces, radii, borders, texture, ornament, concrete density values — the guide has no opinion). No color, font, radius or pixel value appears on the Fixed list.

- Replaced "all sections are normative" with the three-level framing, and stopped asserting blue/slate/Public Sans as the identity rather than one instantiation of it.
- Added **Making it yours** to §9: the three files that carry identity in order, worked token sets for two deliberately opposite products — a dense hairline trading desk and a rounded campaign tracker with a display serif — and the boundary that identity must not be expressed through per-page style blocks, one-off literals, deep selectors, or copied component source.
- Connective rule tying this to the signals section: **identity lives in what stays constant, signals live in what varies.** A campaign tracker may put the whole page on parchment; it may not give every card an ornate border, because the semantic edge marking an exception would then have nothing left to say.
- Softened the type scale (relationships are the rule, values are a default), separation, and border/radius statements from law to defaults.

**Audit: no identity is hard-coded outside the theme files.** Zero hard-coded palette colors anywhere in `app/` — every color reference is semantic (`text-muted`, `bg-elevated`, `text-warning`), so a host's palette swap reaches all of it.

**A defect I reported and then disproved.** 14 hard-coded `rounded-lg`/`rounded-md` utilities looked like they would defeat a host's radius choice, so I replaced them with a `--radius-card` token. Checking the generated CSS showed Nuxt UI already redefines the whole `rounded-*` scale as multiples of `--ui-radius` — those utilities were tracking the host correctly all along, and my token pinned cards to a fixed value, making re-theming worse. Reverted in full (restored counts verified per file) and the token removed. The guide now records the real behavior instead, plus the general lesson: check whether the component library already routes a property through its own knob before adding a token that duplicates it.

Checks: `nuxt typecheck`, `eslint .` (zero errors/warnings), five tests, and a production build passed. Confirmed in the built CSS that `rounded-lg` still resolves to `calc(var(--ui-radius)*2)`.

**Not verified:** the two example identities in §9 are written as token sets but have not been built and viewed. Their claim — that a wholesale palette, typeface and radius swap changes nothing about component contracts, verbs, confirmations, states or focus behavior — is supported by the hard-coded-color audit and by the theme layering, but not by a rendered side-by-side. That remains the strongest available proof and still needs the browser pass the earlier entries describe.

## Visual interest pass — 2026-09-08

Added the visual signals the implementation had left unused, and gave the guide a positive rule for them — it previously only constrained, which is why the result came out uniformly flat.

- **Surface layering.** Supporting panels, metric cards and summary asides use the soft card variant; content cards stay outline. The app previously had exactly one `soft` usage, so every card carried the same weight.
- **Empty-state icons.** All 18 `UEmpty` surfaces had none. Each now names what is missing; `DataTable` resolves its own (inbox for no records, search for no matches) through a new `emptyIcon` prop.
- **Iconography.** Second-level navigation and labeled buttons naming a stable concept — Publish, Review sections, Manage students, All assessments, Show all sections — gained leading icons. Icon-only universal actions were already correct; this was the other half of that rule.
- **Semantic edge.** A 2px leading border in the status color marks section cards with a blocker and the two exception summaries, alongside the status word rather than instead of it.
- **Identity and texture.** Instructor avatars on section cards and course detail; mono for machine-formatted values only — schedules, timestamps, seat ratios — never titles or prose.

**Icon bundling defect found and fixed.** 26 of the 39 icons this app references were not in the client bundle and were being fetched from the public Iconify API at runtime, including pre-existing ones such as `pencil`, `trash-2` and `archive`. The build reports "server bundle mode: local" and the icons render, so nothing looked wrong; the SPA build has no icon API route, so the client falls through to `api.iconify.design`. Enabling `icon.clientBundle.scan` moved the bundle from 43 icons to 70 (18.15KB), and every referenced icon now ships locally. This predates the visual pass but the pass would have widened it. The README claim that icons are bundled locally was false and is now accurate.

Checks: `nuxt typecheck`, `eslint .` (zero errors/warnings), five tests, and a production build passed. Bundled-versus-referenced icon names were diffed programmatically against the generated client bundle.

**Not verified:** still no browser pass — Playwright is not installed in this checkout and `ssr: false` means an HTTP check reaches only the SPA shell. The soft-surface contrast in both themes, edge-marking colors, icon alignment inside labeled buttons at 44px touch targets, and mono legibility at 13px all need the browser review the earlier entries describe.

## Guideline conformance pass — 2026-09-08

Moved rules out of prose and into the layer that can enforce them; fixed the app where it had drifted.

- **Kit.** `DataTable` gained a resolved empty-state contract (`emptyTitle`/`emptyDescription`/`emptyActions` plus an overridable `empty` slot rendering `UEmpty`), a `focusFallback` for bulk actions whose selection toolbar unmounts with the selection, and a `view` prop making cards a presentation of the same row model rather than a second collection. `mobile-metadata` became `card-metadata`; `card-leading` was added. `empty` is resolved rather than forwarded so the contract survives slot pass-through.
- **Theme.** Reduced motion is now a shared skeleton default plus a `prefers-reduced-motion` rule; spinners keep turning, placeholder pulse stops. Added a `--text-metric` token, pointed `--spacing-page` at the documented 20px default and actually referenced it from the panel body — it was previously dead and disagreed with the padding in use.
- **Feedback.** Removed every `toast.clear()`. `useArchive` now dismisses its own toast by id, so a second archive no longer destroys the first Undo and a save no longer evicts an unread persistent error.
- **Accessibility.** The blocked-approval control on Requests uses `aria-disabled` with the reason in its accessible name; as a native `disabled` button it fired no events, so its tooltip could never open. `focusDemoHeading` now targets the innermost marker instead of always resolving to the shared page title.
- **Consistency.** Planning detail gained the same record menu, `InlineStatus`, heading scale, and `UEmpty` unavailable state as Course detail, and dropped its duplicated status/schedule. Planning list, Courses catalog and `SectionCard` now use the shared status and action-menu compositions. Breadcrumb trails start at the first ancestor with a destination, so sibling pages share one shape. Gallery subheadings no longer outrank the page title.
- **Labels.** "Enroll" became "Manage students" where the button opens the course editor; the Sections attention filter shows an active-state badge; the assessment weight field states the remaining budget before submission rather than only on a rejected save.

Checks: `nuxt typecheck`, `eslint .` (zero errors/warnings), five focused tests, and a production build all passed. The built server was started and every application route returned 200.

**Not verified:** no browser pass. Playwright is not installed in this checkout, and the app is `ssr: false`, so an HTTP check exercises only the SPA shell. The rendered behaviour of the changed pages — the cards/table toggle, the resolved empty states, bulk-action focus landing, the `aria-disabled` approve control, and both themes at mobile width — still needs the browser review the earlier entries describe.

## API anchor scrolling fix — 2026-09-08

- Component anchors could scroll the fixed UDashboardGroup because `overflow-hidden` still permits programmatic scrolling. That displaced the entire dashboard, hid the header, and left a matching blank strip below it. Override the shell with `overflow-clip`; the panel body remains the scroll container.
- Browser verified component jumps, scrolling back to content offset zero, and scrolling to the final content offset on desktop. The shell stayed at offset zero and its bottom matched the viewport, with no blank strip. Mobile component jumps also kept the shell fixed. Lint and production build passed.

## Gallery API reference — 2026-09-08

- Added `/gallery/api` to the gallery toolbar and sidebar. Documents all ten kit wrappers, four demo components, and the gallery Example component, including required props, effective defaults, valid options, callback behavior, events/models, scoped slots, exposed APIs, and complete copyable Vue examples.
- Type checking, lint, and production build passed. A one-off source audit matched all 15 component files and every declared prop against the catalog; all 15 examples parsed and compiled with the Vue SFC compiler.
- Browser checks passed for search by prop (`serializeState`), empty search and reset, Demo filtering (four results), component hash navigation, and clipboard output. No browser warnings/errors were recorded. At 390px width, the page had no document overflow; wide reference tables and code blocks scroll within their containers.
- Documented the existing `EntityForm.valid` omitted-prop behavior (Vue casts it to false), without changing the wrapper. Examples pass validity explicitly. Production build retained upstream plugin-timing and package-export deprecation notices.

## Modal/page forms and optional delete — 2026-09-08

- One EntityForm body now renders through a small EntityFormContainer for modal/page presentation. ConfirmButton owns native popover confirmation and optional tooltip. No domain data was added to the kit.
- Browser checks passed: page form renders without a dialog; successful save remains inline and resets dirty state; save/delete failure preserves input; confirmed deletion works; Cancel/Keep editing preserves drafts; accepted discard navigates away; page creation transitions to edit after saving.
- Delete gating verified for create mode, showDelete=false, and omitted deleteAction. Mobile modal footer places Delete left, Cancel/Save right on the same row. Confirmed modal deletion closes the modal; New has no delete shortcut.
- Evidence: `output/playwright/edit-footer-delete-mobile.png` and `page-form-mobile.png`. Copy contracts now include EntityFormContainer.vue and ConfirmButton.vue.

## Agreed design choices — 2026-09-08

- Updated the guide, component gallery contracts, and README for all nine decisions. The external reference remained read-only.
- Shared badge sizing and quiet hover/focus styling use Nuxt UI configuration; form buttons widen on mobile without reversing order. Status colors are shared outside the kit. Status columns are content-sized, and corresponding course detail fields preserve table order.
- Browser checks passed: row navigation is off by default; enabling the gallery toggle navigates from ordinary cells; checkbox and expansion controls remain independent; mobile row navigation works. Mobile form Cancel precedes Submit with wider targets. Mobile toast viewport is centered. Screenshots: `agreed-mobile-toast.png`, `agreed-mobile-form.png` in `output/playwright`.
- Added a focused row-navigation guard test for interactive targets, selected text, modified clicks, and non-primary clicks. The guard is a documented copy dependency for DataTable/ListItem.
- Existing small mobile filters remain inline. No unnecessary wrapper or mobile field-reordering engine was added. Larger filter sets remain a documented host adaptation using native slideover controls.

## Course workflow and mobile refinement — 2026-09-08

- Type checking, linting, four automated tests, and production SPA build pass. Tests cover enrollment/publication blockers and CSV escaping.
- Browser checks: create/publish section; approve a request, fill the last seat, block the next approval, and show the enrolled student in course detail; cancel decline confirmation; assessment edit validation rejects an overweight total, preserves input, and saves a corrected value.
- Verified independent parent/assessment modal query keys, mobile navigation closing on selection, and collapsed Courses popover navigation. Collapsed native navigation labels remain screen-reader accessible through the component styling hook.
- Inspected updated section/request layouts in mobile dark mode, sections in desktop light mode, and course detail in mobile/desktop light mode. Checked mobile overflow and measured centered icon-only button content within 44px targets, including hover appearance.
- Production preview loaded course detail directly and navigated to the Assessments child route. Screenshots are under `output/playwright/` with `*-final`, `mobile-icon-*`, and `course-detail-*` names.
- External UI Design System remained read-only. Domain rules are application code; interaction primitives remain native Nuxt UI. This pass is not a comprehensive accessibility or cross-browser audit.

Verified locally on September 8, 2026 using Node 24.19.0, pnpm 12.3.4, and Chromium through Playwright CLI.

## External-reference revision — September 8, 2026

Selected changes: compact page headers (1), table hierarchy (2), card/list recipes (4/5), detail composition (7), paired gallery annotations (9), and explicit visual rules (10). The external folder was inspected only; no source files there were changed.

- Latest application type check, lint (zero warnings), CSV tests (2), and production build passed.
- Nine kit components and csv.ts copied into `output/portability-v2`, a separate minimal Nuxt host with no demo imports. Type check and build passed; final confirmation-focus adjustments were copied and type-checked again. Dependencies are shared through a local junction, not independently reinstalled.
- Browser verified course creation with relationships deferred, contextual submit labels, disabled pristine editing, direct `?edit=c1` opening/closing, dirty Back navigation with Keep editing/Discard, and Archive with working Undo.
- Browser verified bulk-delete cancellation and execution, initial Cancel focus in the modal and single-record popover, and focus restoration to the row menu after cancellation.
- Desktop-to-mobile switching retained selection and expansion. Long session titles wrapped without page overflow; a new session was saved from its direct query URL.
- Visually inspected the compact catalog, side-by-side recipe gallery, stacked mobile gallery, detail layout in light/dark, mobile detail lists, and mobile planning cards. Screenshots use the `revision-` prefix in `output/playwright`.
- Final production preview is available on port 3101. Checked the component gallery on mobile, its working Archive/Undo preview, and direct child-route navigation.

Nuxt UI supplies the controls and interaction primitives. Custom code is limited to compositions, shared row-model rendering/CSV export, route-query coordination, and domain state reversal. UEmpty, UAccordion, and UProgress are used directly rather than replaced with custom engines. Expanded filter-bar/mobile redesigns (6/8) remain outside this selected visual pass.

## Initial baseline checks (before the revision)

These historical checks describe the original implementation; behavior superseded above includes archive confirmation and selecting relationships during creation.

### Build and source checks

- `pnpm typecheck`: passed.
- `pnpm lint`: passed with no errors or warnings.
- `pnpm test`: two CSV tests passed, covering quoting, multiline text, empty values, and formula neutralization.
- `pnpm build`: passed. Upstream build tooling emits plugin timing and Node package-export deprecation notices; they do not prevent the build.
- Copied all five extensions and csv.ts into a separate minimal Nuxt host with no demo imports. Its type check and production build passed. The host uses the same installed dependency versions through a local node_modules junction.

### Browser workflows exercised

- Course creation, required-field validation, save toast, editing, and dirty cancellation without changing the original.
- Duplicate prefill, archive, delete cancellation, confirmed deletion, and the menu-to-popover handoff.
- Global search, column filtering, sorting, pagination, selection, bulk archive/delete, column hiding, and filter changes clearing selection.
- Downloaded filtered CSV contained all five Biology rows; downloaded selected CSV contained one selected row and omitted the hidden Credits column.
- Desktop-to-mobile switching retained row selection and expansion. Mobile controls supported the same collection operations.
- Course Overview/Students child navigation, browser back/forward, reload at a child URL, and missing course/session states.
- Sidebar collapse/expand, mobile navigation opening and closing after route selection, light/dark appearance, and keyboard checkbox selection.
- Game session creation with participant selection, long-title rendering, and switching between cards and table/mobile list.
- Failed confirmation, delayed confirmation with disabled repeated submission, failed-save input preservation, and recovery after simulated failure.
- Guide rendering from the shared Markdown source, component gallery, and layout recipes.
- A final direct-route and keyboard check completed with no captured page errors.
- Production preview on port 3100 successfully loaded the course index, a direct Students child route, and the component gallery with no captured page errors.

### Visual review

Inspected screenshots at desktop and 390px mobile widths in light and dark modes. Checked course tables/cards, planning cards, long titles, guide tables, gallery annotations, and recipes. No page-level horizontal overflow was found in the inspected mobile guide, recipes, or planning layouts.

Screenshots and downloaded CSV evidence are in `output/playwright/`. Temporary portability fixtures are in `output/portability/`. These generated artifacts are ignored by Git.

This is a local functional and visual review, not a full assistive-technology or cross-browser certification. Production data services, authentication, and server-side pagination are intentionally outside this session-only example.
