---
name: nuxt-ui-guidelines
description: Build, adapt, or review information-dense Nuxt 4 and Nuxt UI 4 interfaces using portable interaction, layout, theme, form, table, and accessibility conventions. Use for dashboards, record workflows, and adopting the bundled kit; not unrelated backend or deployment work.
---

# Nuxt UI guidelines

Make purpose and the next action apparent through hierarchy, placement, and familiar controls. Preserve the host's identity: the example's palette, fonts, radii, fictional records, and SPA architecture are not requirements.

## Agent compatibility

Use this same `SKILL.md` entrypoint in Codex or Claude Code. Resolve bundled paths relative to this skill folder, not the host project's working directory. Read the host's applicable project instructions, including `CLAUDE.md` when using Claude Code. Use the current agent's available file, shell, and browser tools; no Codex-specific tool or connector is required. This skill is also bundled in the Nuxt UI Guidelines plugin with the official documentation MCP. For Claude installation and invocation, read [agents/claude.md](agents/claude.md). The `agents/openai.yaml` file supplies Codex UI metadata only.

## Apply to the host

Prioritize task clarity, intuitive navigation, visual hierarchy, readable presentation, and efficient completion. Review the common user journey first. Apply safeguards in proportion to potential loss and existing recovery; a focused presentation or usability task does not imply building unrelated form infrastructure.

1. Inspect project instructions, dependencies/lockfile, theme, layout, and relevant pages/components. Reuse existing compositions before adding another.
2. Read the opening principles in [references/guidelines.md](references/guidelines.md), then use its review map for the relevant sections. This is the bundled design specification, not an upstream API manual.
3. Distinguish **Fixed** interaction/accessibility invariants, **Default** conventions that can change centrally, and **Yours** identity decisions. Explicit user/project choices take precedence. Record deliberate default changes in existing project guidance rather than varying equivalent controls by page.
4. Implement through native Nuxt UI props, slots, theme configuration, and composition. Check installed types and generated `.nuxt/ui` themes for version-sensitive APIs; consult official documentation when needed. Do not replace native table, dialog, menu, or routing engines to imitate a mockup.
5. Consult [references/example-app.md](references/example-app.md) to find relevant gallery and application examples. Preserve their variety as inspiration; read only pages relevant to the task. When copying components, read [references/adoption.md](references/adoption.md) and the selected source in [assets/example-app/app/components/kit](assets/example-app/app/components/kit). Copy only the needed set and local dependencies. These are optional starting implementations, not mandatory wrappers or proof that every guideline is implemented.
6. Verify changed behavior using [references/verification.md](references/verification.md). Report actual checks and gaps; historical example-app verification does not test the host.
7. Before reporting the work as done, run the confirmation pass in section 13 of [references/guidelines.md](references/guidelines.md): re-read the sections the change touched, look at the rendered result at desktop and narrow widths in both themes, walk the checklist for the changed areas — including the visual-contrast and explanatory-prose questions — and compare the result to the host's existing identity and patterns. Fix what the pass finds or state it as an outstanding gap. Making the change is not finishing it, and type checking, linting, or a passing build is not visual or accessibility verification.

## Use Nuxt UI documentation tools

Prefer the available official Nuxt UI MCP server for component discovery, props, slots, events, theme APIs, and upstream examples. Read [references/nuxt-ui-mcp.md](references/nuxt-ui-mcp.md) when using or configuring that connection. Use an existing global connection or the plugin connection; discover available tools rather than hard-coding agent-specific tool prefixes. The guidelines govern design decisions, the bundled gallery supplies inspiration, and installed project types establish version compatibility. If the server is unavailable, continue with installed types and official documentation rather than blocking unrelated work.

## Put decisions in the right place

- **Theme:** font/size/spacing tokens, palette, radii, row/touch sizing, shared defaults, reduced motion, and shell notifications. Merge existing settings. Use `UTheme` for deliberate subtree differences and native `ui` slots for instance differences.
- **Compositions:** repeated action vocabulary, confirmation/focus behavior, shared forms, status rendering, collection state, and CSV handling. Prefer native components directly when a wrapper changes nothing.
- **Host pages/services:** business rules, permissions, domain status mappings, persistence, routing, drafts, and actual Undo. No fixtures or hidden store imports in reusable components.
- **Judgment:** container choice, information priority, and labels that match the action's actual result.

## Preserve the interaction contract

- Size components primarily through their native `size` prop. Customize size labels and defaults in each component's global configuration for consistency; use `md` as the recommended mobile button/form-control default. Avoid specific dimensions that stretch controls independently of their content. Verify rendered touch size, spacing, and internal alignment.
- One clear page heading and at most one solid-primary action in the active context. Align comparison values and emphasize identity before metadata. Constant identity and varying semantic signals serve different purposes, and character — ground, texture, ornament, a treatment under the cursor — is a third layer that stands for nothing and is not optional: keep it out of the resting layer where signals live, define it once in the theme, and never let it read as a state.
- Text is a carrier, not the default carrier. Let the most direct instrument hold each piece of meaning — status as a badge, proportion as a native progress element beside its figure, a person as an avatar and a name, a destination or repeated concept as an icon with its label, a formatted value in mono, parallel facts as aligned label/value rows or a table, a supporting panel as a quieter surface. A page that is legible, correct, and made entirely of paragraphs has failed these guidelines, not passed them; producing no violations is not the standard. This does not license ornament that stands for nothing — apply per-record signals rarely, per-type signals to a whole class, and keep character on the shell and on interaction.
- Use Open, Edit, Duplicate, Archive, Delete consistently. Duplicate opens an unsaved draft. Row actions remain available without hover; identity links remain when enabling row-click shortcuts.
- Reversible actions confirm nothing and offer Undo. Irreversible ones confirm in a native popover by default, and in a modal when the confirmation must carry a count, a cascade, or a watched pending state. Name scope/consequences, initially focus Cancel, and restore focus or use a host fallback when a trigger disappears.
- Color names a state or a role; neutral carries everything that makes no such claim, including the trigger of a destructive action, whose color belongs on the confirmation's commit button. Support light, dark and system, default to system, and render preference-dependent controls inside `ClientOnly`.
- Explanation is spent, not free. Make the label or the option names carry it; keep persistent help to the few fields where a value would otherwise be wrong; put background where the reader can go — a sentence for the whole group, a docs link, an expandable, or an info trigger, whichever fits, none of them required. A form where every control carries a paragraph cannot be scanned. Deleting prose is half the move: give the meaning it carried a non-text home rather than leaving the page merely emptier.
- An unreachable hint is a broken trigger: give it a focusable named button, not permanent body text. Permanently visible is not the accessible form of deferred.
- Reuse related New/Edit fields and validation. Keep Save disabled for unchanged edits as a recommended default; make invalid-submit behavior help users discover errors. Cancel precedes Submit on desktop and mobile. Use section 6 for input recovery and proportional cancellation safeguards; the example's protected EntityForm is optional.
- Distinguish loading, refresh, pending, empty, no matches, and failure. Use real request state, retain context, offer retry, and never mislabel stale results as matching a new request.
- Table/mobile/card presentations share one native row model and collection state. Export visible data columns from filtered/sorted results or explicitly selected filtered rows; retain CSV escaping/formula protection. Remote data needs an explicit server contract.
- Child sections use real route links beneath a persistent entity header, with the active one carrying a native `highlight` indicator; local panels use native tabs. Preserve direct URLs, exact Overview matching, Back/Forward, and collapsed/mobile navigation.
- Preserve keyboard access, visible focus, accessible names, labels, text status, readable themes, and non-overlapping mobile touch targets. A disabled control's tooltip cannot be its only explanation.
- Undo actually reverses the operation. Dismiss notifications by id; never clear unrelated errors or Undo notices.

## Package boundary

This folder is self-contained. Its guide and source snapshot come from `nuxt/ui-guidelines` on 2026-09-09. The full source app, gallery, fictional data, theme, tests, manifest, and lockfile are included under `assets/example-app/`; dependencies, generated artifacts, and the reference app's own development log are excluded. The only verification document here is [references/verification.md](references/verification.md), the review checklist. The single bundled specification is `references/guidelines.md`; the example app imports it directly. The external HTML remains provenance only. Keep [assets/example-app/LICENSE](assets/example-app/LICENSE) with copied source. Applying this skill does not require global installation, the external HTML reference, or changes to unrelated projects.
