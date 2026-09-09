# Nuxt UI Guidelines vs. DND Campaign Style Guide

## Executive summary

The guides are broadly compatible, but they are not identical. There are **2 direct conflicts**, **3 softer tensions**, and several areas where the project guide is silent while the Nuxt UI Guidelines are more prescriptive.

The detailed project reference is `theme-guide.md`; the shorter `StyleGuide.md` is mostly compatible and does not contradict the guidelines on its own.

## Direct conflicts

| Area | Nuxt UI Guidelines | Project guide | Assessment | Recommended resolution |
|---|---|---|---|---|
| Primary button variant | The main creation/submission action defaults to `primary / solid`. Secondary toolbar actions use `neutral / outline`; utility actions use `neutral / ghost`. | The theme guide makes `outline` the global `UButton` default and describes outline as the primary-action default. See [StyleGuide.md](StyleGuide.md:50) and [theme-guide.md](theme-guide.md:635). | **Conflict.** A button that omits `variant` can be rendered as an outline even when it is the page's main submit/create action. | Keep the project's branded outline style only where deliberately chosen; require `variant="solid"` for the active create/submit action, or change the global default to solid and opt into outline for secondary/ordinary actions. Record the decision centrally. |
| Destructive confirmation scope | Single-record deletion uses a native popover; bulk or cascading destruction uses a modal. Confirmation must match risk. | The project guide says to use `ConfirmActionPopover.vue` for destructive-action confirmations before inline popovers or `window.confirm`. See [StyleGuide.md](StyleGuide.md:35) and [ConfirmActionPopover.vue](app/components/shared/ConfirmActionPopover.vue:57). | **Conflict if applied broadly.** A popover is insufficient for bulk/cascading consequences. | Narrow the rule to “use `ConfirmActionPopover` for single-record destructive actions.” Require a native modal for bulk/cascading operations, with explicit scope/consequences, Cancel initially focused, pending state, and focus restoration. |

## Partial tensions that should be clarified

| Area | Nuxt UI Guidelines | Project guide | Assessment | Suggested clarification |
|---|---|---|---|---|
| Type scale ownership | Type relationships should be preserved, but sizes should be expressed as theme tokens and defined once. | The theme guide centralizes styling, but its `app.config.ts` examples contain repeated literals such as `text-[11px]`, `text-[13px]`, and `text-[9px]`. See [theme-guide.md](theme-guide.md:314). | **Soft tension.** The values are centralized, but they are not named type-scale tokens, so the scale can drift or be hard to audit. | Add named tokens such as `--text-page-title`, `--text-label`, and `--text-data`; use those tokens in shared component defaults. Keep the project's larger Cinzel/Crimson Pro scale because the guideline explicitly allows host identity choices. |
| Card ornament and semantic signals | Visual differences should vary with something real; identity ornament belongs mainly in the shell, and per-record signals should remain rare. | Every `.dmvault-card` gets a gold hover shimmer via `.dmvault-card::before`. See [theme-guide.md](theme-guide.md:258). | **Potential tension.** The shimmer is an identity treatment, not a functional status, but applying it to every card can compete with meaningful per-record signals. | Keep it only if it remains subtle and does not imply status. Prefer shell-level branding or reserve card accents for actual semantic exceptions. |
| Color-mode preference | The guidelines require light, dark, and system preference support and review of all three relevant states. | The theme guide sets dark as the default and fallback, while the toggle cycles through dark, light, and system. See [theme-guide.md](theme-guide.md:560). | **Compatible with a caveat.** Dark-first is allowed; the system mode must still be tested and remain functional when selected. | State explicitly that dark is the product default, while system is an available user preference—not a contradiction. |

## Guideline requirements missing from the project guide

These are not conflicts; they are areas where the Nuxt UI Guidelines are more specific and the project guide could be strengthened.

| Topic | Nuxt UI Guidelines expectation | Current project-guide coverage |
|---|---|---|
| Action vocabulary | Use `Open · Edit · Duplicate · Archive · Delete` consistently, in that order when present. | Not specified. |
| Collection states | Distinguish loading, refresh, pending, empty, no matches, and failure; keep refresh context and offer retry. | Loading, empty, and error are required, but the states are not differentiated. See [StyleGuide.md](StyleGuide.md:66). |
| Undo | Undo must actually reverse the operation; notifications are dismissed by id without clearing unrelated errors. | Not specified. |
| Draft safety | Create/edit forms share one schema and preserve drafts after save failure; dirty navigation is guarded. | Typed validation and async feedback are specified, but draft preservation and dirty-navigation behavior are not. See [StyleGuide.md](StyleGuide.md:83). |
| Tables and responsive lists | Desktop table and mobile/card views share one row model and collection state; filtering, sorting, selection, pagination, and CSV behavior remain coherent. | Table slots are covered, but the shared collection-state contract is not. See [StyleGuide.md](StyleGuide.md:45). |
| Route vs. local tabs | Child sections use real route links; `UTabs` are only for local panels that do not need independent URLs. | The theme guide does state this explicitly, so this is covered in [theme-guide.md](theme-guide.md:1718). |
| Touch sizing | Touch actions should reach at least 44px in coarse-pointer/mobile contexts, without shrinking content to achieve density. | Keyboard access, focus, and contrast are covered, but touch sizing is not explicit. See [StyleGuide.md](StyleGuide.md:89). |
| Disabled-control explanations | A disabled control's tooltip cannot be the only explanation; provide visible context or an accessible guarded alternative. | Not specified. |
| Focus restoration | Destructive actions that remove their own trigger must leave focus somewhere sensible. | Not specified. |
| Reusable component portability | Reusable components should have public props/slots/callbacks, no demo records or hidden store/route dependencies, and documented contracts. | Reuse and explicit props are encouraged, but demo-data isolation and portability contracts are not explicit. See [StyleGuide.md](StyleGuide.md:40). |

## Areas that already align

- Nuxt UI primitives are preferred before custom components.
- Pages should stay thin and repeated UI should move into components/composables.
- Theme/config keys should be documented and centralized.
- Internal navigation uses `to`/`NuxtLink`, not bare anchors.
- The theme guide's header-prefix active behavior and sidebar router-active behavior match the routing guidance.
- `UTabs` are reserved for in-page modes rather than section-level navigation.
- The dashboard sidebar uses `collapsed-size="0"` and unique panel storage keys.
- Both guides require accessible controls, visible focus, semantic labels, and explicit loading/error feedback.
- The project's dark/parchment palette, Cinzel/Crimson Pro typography, and 4px radius are identity choices. The Nuxt UI Guidelines explicitly leave palette, fonts, and radius to the host.

## Recommended precedence

1. Treat accessibility, risk-matched confirmation, state clarity, focus behavior, and native routing as fixed behavioral requirements from the Nuxt UI Guidelines.
2. Treat the DM Vault palette, typography, dark-first preference, parchment light mode, radius, layout chrome, and navigation placement as project identity decisions.
3. Resolve the two direct conflicts by changing the wording in `StyleGuide.md`/`theme-guide.md`, then enforce the chosen defaults in `app.config.ts` or shared compositions.
4. Add the missing requirements above only where they match the app's actual workflows; avoid copying example-app styling or domain assumptions.

## Bottom line

The style guide does **not** need a wholesale rewrite. It needs two rule clarifications—primary-action variants and single-record versus bulk confirmations—and would benefit from adding the missing interaction contracts to make the Nuxt UI Guidelines actionable during implementation and review.

