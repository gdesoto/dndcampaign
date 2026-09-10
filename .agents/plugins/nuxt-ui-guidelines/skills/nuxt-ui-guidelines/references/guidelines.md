# Intuitive, information-dense interfaces

A portable design guide for Nuxt 4 and Nuxt UI 4. Use it for school portals, planning tools, trading desks, campaign trackers, and any other application where people work with substantial information. The accompanying SPA is a working reference, not a required application architecture — and not a required appearance.

> Make purpose and the next action apparent through hierarchy, placement, and familiar controls.

## Review map

| Review focus | Sections |
| --- | --- |
| Purpose, density, and containers | 1–3 |
| Actions, confirmations, and loading | 4–5 |
| Forms, tables, and mobile lists | 6–7 |
| Layouts, child-route tabs, and navigation | 8 |
| Theme, accessibility, and touch | 9–10 |
| Portability and verification | 11 |
| Rule ownership and verification | 12–13 |

Read the principles first; use tables for defaults and code examples for implementation.

### What is fixed and what is yours

These are guidelines, not a skin. They describe how an interface should *behave* and how its parts should *relate* — not what it should look like. An application that adopts them should still look like itself. Two products built on this guide should be recognizably different at a glance and operable without relearning anything.

Every statement here sits at one of three levels. When a rule and an identity conflict, check which level the rule is on before giving either one up.

| Level | Meaning | Examples |
| --- | --- | --- |
| **Fixed** | Never traded away. These are the guidelines. | Keyboard reachability and visible focus; accessible names; status never carried by color alone; confirmation matched to risk; no Undo that does not reverse; loading, empty, and failure as distinct resolved states; labels that are not placeholders; one action vocabulary used consistently; adequate touch targets |
| **Default** | Sound starting points. Deviate deliberately, decide once, and record it centrally rather than drifting page by page. | 25 rows per page; at most seven data columns; the Open · Edit · Duplicate · Archive · Delete order; toolbar order; one trailing row menu; breadcrumb shape; which variant means "primary action"; disabled Save for unchanged edits |
| **Yours** | The guide has no opinion. Identity lives here. | Hue and palette; typefaces, including display and serif faces; radii from square to fully rounded; border weight or none; shadow, texture, and surface treatment; icon set and style; the concrete density values; illustration and ornament |

Note what is *not* on the Fixed list: no color, no font, no radius, no pixel value. The example application's blue-and-slate, Public Sans, 4px-radius appearance is one instantiation, not the specification. A finance product with hairline borders and a near-square radius, and a campaign tracker with parchment surfaces and a display serif, can both satisfy every Fixed rule without compromise.

One connective rule keeps identity and legibility from fighting. **Identity lives in what stays constant; signals live in what varies.** Spend the identity budget on the shell — background, typefaces, surface character, ornamental frame — and leave the varying layer alone. A campaign tracker may set its whole page on aged parchment; it may not give every card an ornate border at rest, because then the semantic edge that marks an over-capacity encounter has nothing left to say. Interaction is the exception: a treatment that appears only on hover, focus, or press may sit on every instance, because it is addressed to the one element the reader is already pointing at. If a *resting* ornament seems to be required on every instance of something, move it up to the shell or into the interaction layer — do not simply delete it.

### How to use this guide

- This document is a standalone specification: neither the example application nor the external reference is required to understand its rules, and neither is required to be imitated visually.
- Course and game terminology illustrates relationships, not required models.
- Later explicit user/project decisions override these defaults; record exceptions centrally, not through silent page-by-page variation.
- The external reference informs visual choices, while native Nuxt/Nuxt UI behavior takes precedence over its mockup logic.
- Explain any requirement that cannot be met through native props, slots, styling, or composition before replacing an interaction engine.

### Design priorities

Optimize first for an understandable, efficient, visually coherent user experience: task clarity, intuitive navigation, readable hierarchy, useful grouping, and polished presentation. Assess the ordinary user journey before applicable failure paths.

Safeguards should support the task. Match interruptions and implementation effort to the work users could lose and the consequences of the action, accounting for existing recovery. A presentation or usability request does not imply adding unrelated form infrastructure. Apply the relevant sections to the requested scope.

- The example application's identity is blue/slate with Public Sans. It is a demonstration of the principles, not a requirement of them; a host replaces it wholesale.
- Character and clarity are not a trade. Considerate behavior and concise language come first, and an identity that wants texture, ornament, an atmospheric ground, or a shimmer under the cursor may have all of them, provided none of it is mistakable for a signal.
- Accessibility takes precedence over density.
- Popover confirmation, modal confirmation, and reversible Archive deliberately differ by risk.
- The portable toolkit is distinct from domain-specific demo adapters.

## 1. Make the next action apparent

Make purpose and the next action apparent through hierarchy, placement, and familiar controls. An interaction that needs an explanation should first be redesigned. Use concise labels, accessible names, validation messages, and consequence statements when they communicate necessary information.

| Do | Don't |
| --- | --- |
| Give a record a clear name, then supporting metadata | Give every value the same weight |
| Place search above the collection it searches | Explain where users should look for search |
| Use at most one solid-primary action in the active working context | Make every action a filled colored button |
| Show an empty state with its next action | Fill an empty page with a tutorial |
| Keep labels such as Credits on fields | Rely on placeholders as labels |

## 2. Density and hierarchy

### Keep comparison data scannable

- Prioritize identity, essential values, status, then actions.
- Use aligned columns, tabular numbers, compact spacing, and muted secondary text.
- Keep descriptive prose out of comparison columns; show a short preview and put the full description in expansion or detail.
- Never truncate the only accessible version of essential content.

### The three-tier read

| Tier | Content |
| --- | --- |
| Identify | Name and one actionable status |
| Orient | Values, dates, owners, and counts |
| Act | Quiet trailing controls |

Limit each record to two emphases. Right-align numeric columns and use tabular figures, including their headers.

### Type scale

| Role | Size / weight |
| --- | --- |
| Metric value | 24px / 600 |
| Page title | 20px / 600 |
| Section heading | 14px / 600 |
| Body data | 13px / 400 |
| Record identity | 13px / 600 |
| Label | 12px / 500 |
| Supporting metadata | 12px / 400 |

The **relationships** are the rule; the values are a default. A host may run the whole scale larger, smaller, or on entirely different faces, provided the ranking holds: a metric value is the only text that outranks the page title, and no subheading, eyebrow, or section title may be larger than it. Express sizes in relative units, define the scale as theme tokens once rather than repeating utility sizes per page, and let readable mobile inputs exceed the body scale.

### Spacing and surfaces

| Area | Rule |
| --- | --- |
| Desktop rows | Target 36px desktop table rows; allow growth for wrapping, zoom, and touch. |
| Spacing rhythm | Use a 4px layout spacing base: commonly 8px within groups, 12px for compact cards/mobile page padding, and 16px between groups. |
| Desktop page padding | Desktop page padding defaults to 20px and should not exceed 24px. |
| Native controls | Native component padding may use finer increments for optical balance. |
| Separation | Prefer the lightest separator that works: whitespace before dividers, dividers before boxes. A host that separates with color, texture, or shadow instead must still keep one separator meaning one thing. |
| Grouping | Keep related fields close and separate unrelated groups. |

> Density is useful information per glance, not minimum whitespace.

### Visual interest: signals and character

Restraint is a constraint, not a goal. A guide made only of prohibitions produces a legible, uniform, and completely dead interface: every card the same weight, every label the same size, nothing for the eye to catch and nothing that could only be this application. Two different things prevent that, and confusing them is how a guide like this one strips the life out of a product it was meant to sharpen. **Signals** are visual differences that stand for something. **Character** is visual difference that stands for nothing except the application's own identity. A serious interface needs both.

**The test:** ask what a visual difference varies with. Varying with the data makes it a per-record signal. Varying with what the element *is* makes it a per-type signal. Varying with nothing makes it character — which is legitimate, and governed by the rules below rather than deleted.

| Layer | Varies with | Earns its keep by being | Examples |
| --- | --- | --- | --- |
| Per record | the data in front of the reader | **rare** | Semantic edge, status color, avatar, progress |
| Per type | what the control or panel *is* | **invariant** | Icon on an action or destination, surface weight by panel role, mono by value format |
| Character | nothing — and that is the point | **constant, and never mistakable for a state** | Page ground and texture, ornamental frame, display face, a shimmer that sweeps a card under the cursor |

A leading icon on Publish does not vary by record — it is the same icon every time — and that is precisely its value: it varies by action, and only stays recognizable by never changing. An edge marking works the other way round: it is worth noticing because most cards do not have one. Applying a per-record signal to everything destroys it, and letting a per-type signal drift between pages destroys it just as thoroughly.

A shadow on every card varies with nothing, so it is character rather than a signal — but this guide has already spent shadow on surface weight, so using it as ornament takes a word out of the signal vocabulary. That is the real constraint on character: not that it must not exist, but that it must not spend a treatment a signal already needs.

| Signal | Carries | Applied as |
| --- | --- | --- |
| Surface weight | Which content is primary and which supports it | Outline for content cards, soft for supporting facts, summaries, and metric cards. Reserve shadows for overlays. |
| Semantic edge | An exception, visible across a grid without reading | A 2px leading border in the status color on the affected card only, alongside — never instead of — its status word |
| Iconography | A repeated concept, recognized before it is read | Icon-only for universal actions; icon **with** label for stable domain concepts and every navigable destination |
| Identity | Who a record belongs to | Avatars for people wherever a person is named, including instructors and owners, not only in rosters |
| Subject | What a number counts | An icon naming a metric's subject, applied to a whole row of metric cards or none of them |
| Typographic texture | That a value is machine-formatted rather than written | Mono for schedules, timestamps, codes, and ratios. Never for titles, names, or prose. |
| Proportion | A quantity against its limit | Native UProgress for capacity and distribution, where the total is real |

Each of these is already required to mean something elsewhere in this guide, so none of them introduces a new vocabulary to learn. What they add is contrast: a page where supporting panels recede, exceptions announce themselves, destinations are recognizable at a glance, and people have faces.

#### Text is a carrier, not the default carrier

There is a failure mode this section exists to prevent, and it is by far the most common one: reaching for a sentence when the page already had a better instrument. A status becomes a word inside a paragraph instead of a badge; a proportion becomes "18 of 24 seats" in running text instead of a figure beside a progress element; an owner becomes a name instead of a face and a name; a destination becomes a bare link instead of an icon and a label; a set of parallel facts becomes prose instead of an aligned label/value block. Each substitution is individually defensible. Together they produce a wall of grey text that is complete, unreadable at a glance, and indistinguishable from every other application built the same way.

Restraint governs *how much* is on the page, not *which medium* carries it. Cutting a decorative trend chart and cutting the avatar beside a person's name are not the same act: the first removes something that stood for nothing, the second removes a signal and leaves the reader to parse a name. Before writing a sentence, check the table above and ask what this piece of meaning varies with. If it varies with the data, a per-record signal already carries it — status color, semantic edge, progress, avatar. If it varies with what the element is, a per-type signal already carries it — an icon on the action or destination, mono on a formatted value, surface weight on a supporting panel. In either case the sentence is redundant rather than thorough.

**Structure counts as non-text.** An aligned label/value body, a table, a compact total, a count beside a title, a group heading with its records indented under it — each carries a relationship that prose has to spell out at several times the length and with none of the scannability.

None of this licenses ornament for its own sake; every rule above still applies, and a signal invented for a page that has nothing to signal is still noise. What it rules out is the opposite reflex: **a page that is legible, correct, and made entirely of paragraphs has failed this section rather than passed it.** Producing no violations is not the standard, and adding nothing is not the safe choice.

#### Character is the third layer, and it is not optional

An application whose every visual difference is load-bearing reads as corporate and lifeless no matter how correct its hierarchy, and correctness is not what makes someone want to open a tool a second time. A tabletop campaign tracker is entitled to gold that catches the light under the cursor, an inked ground, a frame with weight to it. The failure mode is never ornament as such; it is ornament a reader could mistake for a signal, or ornament crowding out the layer where signals live. Character earns its place under three conditions:

- **It carries no state.** It draws on the identity's own palette rather than the semantic colors, and it appears identically on every member of its class. The moment a treatment is present on some records and absent on others, readers will decide it means something — at which point it must become a real signal or go.
- **At rest it belongs to the constant layer**: the page ground and its texture, the shell's frame and rules, the display face, the surface treatment shared by a whole class of panels. An atmospheric background is character at its most useful, because the reader never scans the background for meaning.
- **On interaction it may sit on every instance.** A hover, focus, or press treatment is transient and addressed to the one element the reader is already pointing at, so it cannot compete with the resting marks the eye sweeps a grid for. A golden shimmer crossing a card on hover is legitimate on every card; the same gold as a permanent border on every card is not, because the semantic edge marking an over-capacity encounter would then have nothing left to say.

Whatever the treatment: it must not reduce the contrast of the content it sits under or behind, must not move layout, must honor `prefers-reduced-motion`, and must never be the only indication of anything — a hover shimmer is atmosphere, not the focus ring, and keyboard focus still gets its own visible treatment on the same element. Define it once in the theme or a shared component default. Ornament copied into three pages will disagree in two of them, and a guide that finds three disagreeing copies will delete all three.

A ground carries a second obligation, and this is the one that actually damages a product: **every surface that carries text must be opaque.** A texture or a gradient reaching the words on top of it costs contrast and legibility, and it is easy to get wrong, because component libraries commonly ship *quiet* surfaces as translucent ones — a soft card at 50%, a sticky table header at 75%, a sidebar at 40%. Those alpha values are invisible on a flat background and defects on a patterned one. Give cards, tables, list rows, inputs, menus and popovers a flat background of their own, and let the ground show in the page padding, the gutters between panels, and the chrome around them. That is the better relationship regardless of legibility: a ground should frame the content, not sit under it. Large chrome type — a page title in a header strip — may sit on the ground directly, because contrast is not in question at that size and weight.

One implementation trap is worth recording, because it fails silently and leaves the page looking flat while the CSS is demonstrably present. A fixed dashboard shell takes its panels out of flow, so `body` has zero height. A flat background color still propagates from there to the canvas and fills the viewport, but a gradient or texture is sized to the box that generated it and collapses with it. Paint the ground on the shell element itself, leave the panels above it transparent, and verify it in a browser rather than by confirming the rule reached the stylesheet.

Icons deserve a specific rule, because the common failure is to apply half of it. Familiar universal actions — edit, copy, delete, play, pause — drop their text and keep an accessible name and a tooltip. That much is usually done. The other half is that a **labeled** button may also take a leading icon when its label names a stable, repeatable concept: Export, Publish, Archive, Filter, or a destination in the navigation. Do not invent an icon for a one-off phrase, and do not let an icon carry meaning its label does not.

### One clear page header

- Page headers contain breadcrumb, title with adjacent count, then actions.
- Do not add a second title, decorative eyebrow, slogan, or introductory paragraph to a working collection page. A reference or documentation page may carry an introduction; it still may not outrank the page title typographically.
- A restrained primary action belongs at the trailing edge.
- Long titles wrap without displacing mobile navigation.

Use semantic headings in order. A page has one main heading. Color reinforces text and icons; it never carries status alone. Reserve the accent color for primary actions, active navigation, and meaningful emphasis.

### Primary actions and quiet surfaces

- A read-only page need not invent a primary action.
- When a modal opens, it becomes the active context and its submit button is the primary action; the inactive page behind it is not a competing action area.
- The example uses 1px semantic borders, ~8px card corners, compact control corners, and quiet surfaces in both themes. Border weight, corner radius, and surface treatment are the host's to choose; what must survive the choice is that surfaces stay quiet enough for their content to lead.
- Text/dates align left; numeric values and headers align right.
- Muted metadata must remain readable.

## 3. Choose the appropriate container

| Pattern | Use for | Avoid |
| --- | --- | --- |
| Data table | Comparing consistent fields across records | Long paragraphs in cells |
| List item | Scanning identity plus a few attributes | Recreating a table as an unaligned list on desktop |
| Entity card | A distinct entity with a short summary | Wrapping every individual field in a card |
| Metric card | A meaningful total and its context | Decorative totals unrelated to the task |
| Detail section | Related facts under one heading | Repeated card-in-card borders |
| Activity list | A sequence of events | Equal emphasis for timestamp and event |
| Planning card | A scheduled item, participants, and next action | Hiding schedule or status behind interaction |

### Native first; wrap only repeated decisions

- Use UCard, UBadge, UAvatar, UTooltip, UDropdownMenu and other native components directly unless shared defaults, behavior, or wiring would otherwise repeat.
- Prefer global Nuxt UI configuration for defaults it supports.
- When configuration is insufficient, a thin field/component wrapper may set defaults or compose repeated wiring while passing through native props, slots, events, and functionality.
- Do not wrap a component when no defaults, behavior, or composition change.

### Card and list recipes

- **Entity:** name/status header, aligned label/value body, count and quiet actions in the footer.
- **Metric:** one label, one value, optional meaningful delta or native UProgress distribution. When the answer is how a total divides rather than one share of it — occupied, claimed, and available seats — native UProgressGroup carries the segments, which must add up to the stated total so a reader can check them. Never invent trends just to fill a card. An icon may name the metric's **subject** — students, rooms, requests — for every card in a row or for none, so no card gains emphasis it has not earned. A generic chart, graph, or trend glyph names nothing and varies with nothing; it is the decorative dashboard reflex this guide exists to prevent. Keep the icon subordinate to the value, and use semantic color only while the metric is genuinely an exception.
- **Summary:** three to five useful rows and one drill-in link; show exceptions before ordinary records.
- **Prompt:** dashed boundary, concise consequence or opportunity, and one neutral-outline action. A prompt is not an empty-state tutorial.
- **Detail:** related records in the main column; a narrower supporting facts panel and separate description. Do not enlarge a count at the expense of useful relationships.
- **Person:** avatar, identity, short context, status, and trailing actions. Native UUser composes the first three; a wrapper around it changes no default and adds no behavior, so status and actions sit beside it in the host.
- **Compact total:** one line with a label and right-aligned count, digits aligned so the figures compare vertically. Reach for this before a row of metric cards; a metric card is for a number the page is about, not for every number it can produce.
- **Group:** native UAccordion heading with count, indented child records and their actions.
- **Decision:** paired approve/decline icons only when reviewing requests is the central workflow; confirm irreversible decline.

### List density and gallery presentation

- Keep a list to identity/status plus two or three supporting attributes.
- Avoid nested cards around each field or list row.
- Gallery previews sit beside rule, rationale, props/slots/events, dependencies and copyable usage on desktop, stacked on mobile.
- Compare contrasting states side by side where useful; production pages omit these annotations.

## 4. Consistent actions and variants

### Action vocabulary

Use the vocabulary **Open · Edit · Duplicate · Archive · Delete**, in that order when present.

| Action | Meaning |
| --- | --- |
| Open | Navigates to a record |
| Edit | Changes the record |
| Duplicate | Creates a prefilled unsaved copy |
| Archive | Changes status |
| Delete | Removes the record |

Actions which do not apply may be omitted. Use the same verbs in menus, accessible names, confirmation prompts, and feedback.

### Color contract

Color is a claim about meaning, not a way to make a control look important. Each role has one job, and a control with no such claim to make stays neutral.

| Role | Means | Used on |
| --- | --- | --- |
| Primary | This action advances the task, or this is the destination you are on | The single solid submit/create action in the active context; the active navigation item and its indicator |
| Neutral | No claim — ordinary chrome | Everything else: secondary actions, utility and row controls, the *trigger* of a destructive action, ordinary counts |
| Error | Something failed, is invalid, or is about to be destroyed | The commit button of a destructive confirmation, validation messages, failure alerts and failed status |
| Warning | A blocker the reader can still act on before proceeding | A blocked row's status, a capacity exception, a metric that has crossed its limit |
| Success | An outcome that actually completed, or a healthy steady state | Save/delete confirmation toasts, Active/Published/Eligible status |
| Info | Notable, and neutral in valence — worth reading, not worth alarm | Informational callouts, scheduled or in-progress status |
| Secondary | A second accent for an axis genuinely unrelated to primary | Rare. If it is only "primary, but less important", it is neutral. |

- **Neutral is the default, including for destruction.** A Delete trigger in a row, card header, or form footer is `neutral / ghost` like every other utility control; the color arrives at the point of commitment, on the confirmation's `error` solid button. Painting every trash icon red spends the alarm before anything is at stake, and a page of red icons is as flat as a page with none.
- **A decision pair may take success and error at the point of commitment.** Where a record's whole purpose is an approve/decline, accept/reject, or publish/withdraw decision, the two halves may carry `success` and `error` so opposite outcomes are not identical grey icons. This is a per-record signal, so it stays rare: one such pair per record, every other control in the row still neutral, and the destructive half still confirming before it acts. A status word in the row's metadata keeps its own color — status and controls are different registers — but a second colored control is one claim too many.
- **Do not borrow a semantic color for a state it does not name.** Success is not "the agreeable button", warning is not "somewhat important", and info is not a substitute for muted text.
- **Status colors are defined once per domain** and reused across table, card, list, and detail — see *Status sizing and meaning*.
- **Color is never the only carrier.** Every status color travels with its word; every colored action keeps its label or accessible name.
- The palette behind these roles belongs to the host. Replacing what `primary` or `error` looks like must not change what either one means.

### Variant contract

| Purpose | Default |
| --- | --- |
| Main creation/submission action | Primary, solid |
| Secondary toolbar action | Neutral, outline |
| Compact utility or record action | Neutral, ghost |
| Card-header utility, text or icon | Neutral, ghost, sm |
| Table expansion or ellipsis | Neutral, ghost, xs |
| Ordinary footer drill-in | Neutral, link, sm |
| Status badge | Semantic color, subtle, sm; include a word |
| Regular content card | Outline |
| Quiet summary card | Soft |
| Destructive confirmation | Error, solid |

### Icon-only versus labeled actions

- Familiar edit, copy, delete, play, and pause buttons use icons without visible text.
- Give each an accessible name such as `Edit Biology`.
- Tooltips clarify ambiguous icons and work on keyboard focus.
- Menus use readable action labels.
- New course and Save retain text because their scope and outcome matter.
- A labeled button may also carry a leading icon when its label names a stable, repeatable concept — Export, Publish, Archive, Filter, or a navigable destination. Dropping text from universal actions and adding icons to labeled concepts are two halves of one rule; applying only the first produces a correct but flat interface.
- Confirmation actions retain explicit labels such as Delete.

### One card-header action style

- Card-header utilities consistently use neutral ghost at the shared small size.
- Keep labels for domain-specific actions such as Enroll or Manage sections; familiar Edit stays icon-only.
- Do not mix outline, link, and ghost for equivalent header actions.
- A footer drill-in link is a different role, not permission to use link styling in a header.
- A card may place its menu in the footer according to its recipe; do not duplicate the same action in header and footer.

### Canonical icons and domain actions

- Use canonical Lucide icons: Open `i-lucide-arrow-up-right`, Edit `i-lucide-pencil`, Duplicate `i-lucide-copy`, Archive `i-lucide-archive`, Delete `i-lucide-trash-2`.
- Icons inherit semantic text color and are approximately 16px in dense controls.
- Copy to clipboard is distinct from Duplicate; Discard changes is distinct from Delete.
- Domain actions such as Enroll, Publish, and Assign are allowed and use consistent labels; place them in a separate group before the standard record actions in menus.
- Paired approve/decline icons are an explicit exception in a clearly identified request-review workflow, with accessible names and tooltips.

### Tooltips clarify; they do not replace meaning

- Use native UTooltip, not browser `title` attributes or a custom tooltip, for ambiguous controls such as Show or hide columns, Export CSV, Expand details, and Actions for [record].
- Keep hints concise but do not enforce a two-word limit that removes scope.
- Tooltips must work on hover and keyboard focus without blocking the underlying control, and must never be the only source of essential information on touch.
- A tooltip or popover the keyboard cannot reach is a defect in its trigger, not a reason to abandon deferred disclosure and print its content on the page. See *Explanatory prose has to earn its place*.

```vue
<UTooltip text="Edit course details">
  <UButton icon="i-lucide-pencil" aria-label="Edit course details"
    color="neutral" variant="ghost" size="sm" @click="openEditor" />
</UTooltip>
```

### One trailing row menu

- Default to one quiet trailing ellipsis menu per table row, not an Edit shortcut beside the same menu.
- Show expansion only when useful extra content exists.
- Separate Delete from the other items.
- Do not nest buttons inside links or make row action clicks also open the row.
- Keep a genuine record link for keyboard and browser navigation.

Quiet controls remain visible in a muted color. Hover and keyboard focus strengthen their foreground and add a quiet background. Never require hover to discover an action, on desktop or touch.

### Identity link by default; row click is optional

- Identity-link navigation is the default.
- A reusable table/list may offer `rowClickable=false`; opting in makes noninteractive row content a navigation shortcut.
- Retain the real identity link and ignore controls, editable content, text selection, and modified clicks.
- Do not nest a whole row of controls inside a link.
- Use native row events where supported and a small shared guard rather than a second navigation engine.

## 5. Confirmation and feedback

### Match confirmation to risk

Confirmation is chosen per action, from what the reader must be told before committing — not from a fixed list of action names.

- **Reversible actions confirm nothing.** Archive acts immediately and offers Undo. Asking twice about something the reader can take back teaches them to dismiss the question.
- **The popover is the default for irreversible actions.** Where the consequence fits in a sentence, use ConfirmButton, built from UButton and a click-triggered UPopover. This is the common case, and it stays beside the record it acts on.
- **The modal is for a confirmation the popover cannot carry**: an affected count, an enumerated cascade, a typed acknowledgement, or a pending/error state the reader has to watch. Bulk destruction is the usual reason to reach for it, but the payload decides, not the word "bulk" — deleting one record that silently removes ten related ones earns a modal, and deleting two independent records does not.
- Both containers implement the same contract below. Neither is a lighter-weight version of the other, and a host may use one, the other, or both.
- Only explicit confirmation executes the operation.
- Identify the entity or selected count and explain the consequence in one sentence.
- Focus Cancel initially.
- Cancel or Escape dismisses without mutation.
- Restore focus to the trigger, or a logical surviving control if the record disappears.
- Every composition that can destroy its own trigger — row menu, single confirmation, form deletion, **and bulk actions, whose toolbar unmounts with the selection it acted on** — takes the same host-supplied focus fallback. One composition omitting it is the gap nobody notices, because focus loss is silent.

### Archive and Undo

- Reversible Archive acts immediately and offers a working Undo toast.
- Restore each affected record's prior status, not a guessed default.
- Use entity-specific success wording and persistent errors.
- Keep notifications restrained and aggregate bulk results; do not evict an actionable error or Undo solely to force one visible toast.
- **Never clear the toaster.** Set `max` and `duration` once in the application shell and let them do the work. A blanket clear cannot tell its own stale notice from another record's live Undo or an error the user has not read yet; dismiss a specific notification by its own id instead.
- Default ordinary successes to about four seconds; keep Undo available for its advertised period.
- Never display Undo unless reversal really works.
- An irreversible archive-like operation requires risk-appropriate confirmation rather than a false promise of reversal.

### Success, failure, and retry

- During execution, prevent repeated submissions.
- Keep a failed confirmation open with a concise error and retry.
- Do not report success until the operation succeeds.
- Use useToast for completed saves and deletes, and concise feedback for archive and duplicate creation.
- Validation stays beside its field; a toast does not replace it.

Opening a Duplicate draft is not completed creation; toast success after saving it. Do not toast routine tab changes, filters, or expansion. Popover and modal confirmations are two containers for one contract, chosen per action by what the reader must be shown — not two competing styles.

Place toasts bottom-right on desktop and bottom-center below md. Respect safe-area insets and provide clearance above mobile form actions or fixed bottom controls. Keep placement in the application shell/shared theme, not page-specific notification logic.

### Loading and pending states

#### Keep loading local

- Show that work is happening at the smallest affected scope.
- Preserve context and layout; a loading state is feedback, not a reason to replace the whole screen.
- Use native component loading behavior and USkeleton before adding custom composition.
- Loading describes fetching content; pending describes an action awaiting completion.
- Neither is an empty or error state.

| Situation | Default treatment |
| --- | --- |
| First load with no content available | Use USkeleton placeholders matching the expected rows, cards, or detail structure. Reserve realistic space to limit layout shifts; do not fabricate data or counts. |
| Refresh, remote filtering, or pagination | Keep previously loaded content visible with a localized loading indicator. Clearly treat it as the previous result until the new result arrives; do not present old rows as matching newly requested filters or a new page. |
| Save, delete, or another command | Show loading on the initiating button, retain its action meaning and dimensions, and prevent duplicate or conflicting actions until completion. |
| Child-route navigation | Preserve the dashboard shell and the current entity's header and section links; indicate loading in the changing section. A different entity must not inherit the previous entity's identity. |
| Independently fetched sections | Load each section independently. A slow activity panel must not block already available details or unrelated controls. |
| Long-running operation | Show actual progress when measurable; otherwise use an indeterminate indicator. Never invent percentages or completion estimates. Offer cancellation only when it actually stops the operation. |

#### Loading, empty, and failure are different states

- For tables, use UTable's native loading behavior and supported slots; give the mobile list the same request state.
- Do not add artificial loading to synchronous in-memory sorting/filtering.
- Show no records or no matches only after a successful resolved request establishes that result.
- On refresh failure, retain useful existing content and show a nearby error with Retry; on first-load failure, show an error/retry state rather than an empty collection.
- Do not use a toast as the sole indication that content is loading.

#### Block conflicts, not the whole interface

- Disable only controls that would duplicate the operation, act on stale results, or conflict with it.
- A submitting form may temporarily lock its fields and closing controls to protect the submitted snapshot; unrelated page sections remain usable.
- Release pending state on success and failure.
- Keep focus stable while loading; do not move focus to a spinner or skeleton.
- Follow the existing completion/focus-restoration rules when an action removes its trigger.

#### Accessible busy feedback

- Mark the affected region with `aria-busy` while a **real asynchronous request** is in flight. Synchronous in-memory sorting, filtering, and pagination have no busy state to announce; adding one there contradicts the rule against artificial loading above.
- Give loading/progress feedback an accessible name and, when needed, a concise polite status announcement; avoid duplicate announcements when native components already provide them.
- Keep skeleton decoration out of the accessibility tree and do not announce every placeholder or percentage change.
- Respect reduced motion **as a theme default**, not a per-page decision: set it once on the shared skeleton/placeholder defaults so every host inherits it. Remove nonessential shimmer and pulsing while retaining a visible, understandable busy state. A spinner on a pending action is the feedback itself and keeps turning; a skeleton's pulse is decoration and stops.
- Indicators must remain legible in both themes.

#### Use the real lifecycle

- Apply KISS: derive loading from the real request or async action lifecycle, using native Nuxt data-fetching state and Nuxt UI behavior where applicable.
- Do not create a parallel loading engine, simulated production delays, or minimum spinner durations.
- Avoid flashing placeholders over already available content.
- Any justified indicator-delay policy belongs in a shared implementation, never scattered page timers; it must not delay the operation itself or duplicate-submission protection.

| Do | Don't |
| --- | --- |
| Keep existing rows visible during a refresh with localized feedback | Blank the whole dashboard on every filter change |
| Preserve card/row geometry with representative skeletons on first load | Display zero totals or an empty-state invitation before data arrives |
| Show pending on Save and block conflicting actions | Freeze unrelated controls or report success before completion |
| Retain useful content and offer Retry after a failed refresh | Leave an endless spinner or silently relabel stale results as current |

## 6. Shared forms

Make forms easy to scan and complete: group related fields, use clear labels and sensible defaults, and keep the next action apparent. Choose inline, modal, or page presentation by the task's complexity and the context users need.

### Shared fields where useful

- Reuse fields and validation for New/Edit where they express the same business rules.
- Keep entity-specific state and persistence in the host; use a shared shell only when it removes repeated behavior.
- A page form uses normal page layout and navigation without a dialog focus trap.

### Field and footer placement

- Place labels above fields; placeholders illustrate format, never replace meaning.
- Preserve shared field order.
- In the footer, place neutral-outline Cancel immediately before primary-solid Submit, right-aligned on desktop.
- On mobile retain this order and allow wider buttons to improve interaction; do not reverse their positions.

### Explanatory prose has to earn its place

A page where every control carries a paragraph reads as thorough and behaves as unusable. The prose is uniform grey, there is nothing to scan, and the two sentences that mattered are buried among twenty that did not — so the reader skips all of them. Explanation is a cost like any other density decision, and it is spent, not free.

Ask three questions in order, and stop at the first that answers.

1. **Can the control say it itself?** This is the best outcome, because it removes the prose rather than relocating it. A specific label beats a vague label with a description under it. Name the options rather than explaining them — *Individual — lower cost* needs no sentence. Put the unit in the label or the field, show format with a placeholder, and let a sensible default carry the recommendation.
2. **Does the reader need it before they act?** If a reasonable person would otherwise enter a wrong value or misjudge a consequence, give it one short line of persistent help. This is an exception with a budget, not a per-field default.
3. **Otherwise it is background**, and belongs somewhere the reader can *go*, rather than somewhere they must walk *through*.

For that third case there is no single required mechanism. Choose by how much there is and how often it is wanted: one sentence introducing a whole group instead of one per field; a link to documentation that can hold the full story; an expandable *About these settings* the reader opens once; an info trigger revealing a tooltip or popover beside the control. An info icon is one option, not the house style, and a page that grows a row of them has usually just moved the wall of text behind twenty separate clicks.

Prose that survives none of the three is deleted. Text that restates its label, explains the self-evident, or is kept because it might help someone once is not documentation; it is what makes the lines that matter invisible.

**Deleting prose is only half the move.** The meaning it was carrying usually still needs a home, and that home is rarely another sentence. A status word becomes a badge; a proportion becomes a progress element beside its figure; an owner becomes an avatar and a name; parallel facts become an aligned label/value block or a table; a repeated concept becomes an icon with its label. Cutting the explanation without giving its meaning a carrier trades a wall of text for a page that is merely emptier. See *Visual interest: signals and character* in section 2.

**Grouping beats repetition.** One sentence at the top of a section routinely replaces six field descriptions, because most of what those descriptions repeat is the shared context, not the individual field. Prefer explaining the group.

**Permanently visible is not the accessible form of deferred.** Deferred disclosure is fully accessible when its trigger is real: a focusable `<button type="button">` with an accessible name, associated with `aria-describedby`, reachable by keyboard and usable on touch. A hint nobody can reach has a broken trigger, not a broken idea. Promoting it to permanent body text is a *separate design decision*, and one that has to be justified on its own merits — applied across a whole form it trades one defect for two: prose nobody reads, and a layout that no longer scans.

**Uneven prose breaks a multi-column grid.** Side-by-side fields whose descriptions run to one line and three put their inputs on different baselines, and the row stops reading as a row. Give a row's fields the same treatment, or move the explained one to a full-width row of its own. Do not pad the shorter description until it matches.

### Optional example implementation

The example's protected EntityForm supplies modal/page presentation, save/delete callbacks, completion events, and dirty cancellation. Its [component lifecycle and routing contract](../assets/example-app/docs/form-pattern.md) is relevant when adopting that implementation. Use native UForm or an existing host composition when that fits the workflow better.

### Input recovery proportional to the task

- Keep entered values after a failed save and provide an understandable retry path. This applies to settings as well as record editors.
- For explicit Save/Cancel, keep uncommitted edits separate from saved values so Cancel has its expected effect. Reset intentionally when switching records.
- Add navigation guards or discard confirmation when leaving would lose meaningful work that is not already recoverable. Consider entry effort, existing autosave/recovery, and the clarity of the user's intent; a dirty flag alone does not establish the need for a prompt.
- For a small, easily repeated edit or reliably recovered input, direct cancellation can be appropriate. Clean cancellation needs no prompt. When confirmation is warranted, use Keep editing / Discard changes.
- Keep forms scrollable, actions reachable, and validation failures near their fields, with appropriate focus.

### Validation and submission

- Use contextual submit labels: Create course / Create session and Save changes.
- Validate on blur and submission; focus the first invalid field on an attempted invalid submit.
- Prevent duplicate submission while a save is pending. Disable Save for an unchanged edit as a recommended default.
- Choose invalid-submit behavior for discoverability: allowing an attempted submit can reveal errors and focus the first invalid field; disabling known-invalid submission is appropriate when requirements and errors are already clear.
- Make requirements/validation discoverable so a disabled button never leaves the user guessing.
- Default to deferring optional relationship management until Edit; required relationships belong in both modes.
- Add concise timing guidance only where necessary.
- Keep one shared field/schema implementation even when an optional relationship section appears only after creation.

### Editor navigation

- Keep opening, completion, cancellation, and Back behavior predictable within the host's existing navigation model.
- Use direct links when returning to or sharing an editor is useful; query parameters are one implementation choice.
- Compact edits may fit a modal; use a dedicated page when complexity or supporting context warrants it.

## 7. Tables and mobile lists

UTable owns sorting, filtering, selection, expansion, visibility, and pagination through its existing TanStack integration. DataTable adds a consistent toolbar, mobile composition, and export; it must not implement a second table engine.

- Default to 25 rows per page. Search and filters reset pagination and clear selection.
- Default to at most seven visible data columns, excluding utility columns. Show the displayed range and filtered total in the footer. Pagination and export must operate on actual data, not simulated controls.
- Select-all selects the current page. Bulk prompts name the selected count. Selection can span pages until filters change or the action completes.
- Column headers sort; provide equivalent sort and filter controls on mobile.
- Utility columns (selection, expansion, actions) use content-sized widths and compact padding through native column `meta.class`, for example `w-px whitespace-nowrap px-2` on header and cells. They must not absorb excess width. Give remaining width to data, especially identity; do not shrink mobile touch targets.
- Below the medium breakpoint (`md`, 768px by default), render ListItem cards from the same filtered, sorted, paginated row model. Preserve sort, selection, pagination, and expansion when the viewport changes.
- Keep identity and row controls available. Column visibility applies to data fields; the mobile layout retains its essential identity.
- CSV export uses visible data columns and the sorted, filtered pre-pagination row model across all pages by default, or selected filtered rows when explicitly chosen. Exclude all utility columns. Escape commas, quotes, and line breaks and neutralize spreadsheet formulas in user-controlled strings.
- Distinguish no records from no matches. Offer creation for the first and Clear filters for the second.

### Filters and canonical field order

- Toolbar order is search, filters, optional clear control, then trailing column visibility/export.
- Show active filter state.
- Mobile search stays inline; small filter sets stay inline and may wrap, while larger sets use a native slideover with an active-filter count.
- This adaptive choice does not authorize replacing native filtering logic.
- Apply KISS to field order: define one canonical sequence and preserve it across tables, mobile lists, and corresponding detail facts.
- Allow wrapping/stacking without reordering.
- This governs scanning surfaces only. A form follows task order — required before optional, related fields grouped — and is not expected to match the table's column order.
- Put lower-priority fields in expansion/detail, preserving the relative order of retained fields.
- Do not implement a mobile priority-sorting engine.
- For server-paginated production data, use native manual options and explicit result/total/export contracts instead of fetching an entire database for a client-side demo wrapper.

### Embedded tables

A detail section may render a native UTable directly instead of the full DataTable composition; a short, complete, already-scoped list does not need a toolbar, pagination, or export. Such a table still owes the reader the same reading rules: canonical field order, identity as a link in the first column, right-aligned numerics with tabular figures, utility columns sized through `meta.class`, and one trailing action affordance rather than a different one per section. State sorting or its absence deliberately — a table that looks sortable and is not is worse than one that clearly is not.

### Status sizing and meaning

- Status columns use compact content-based widths sized for the actual labels, not a universal fixed width across applications.
- Define status-to-semantic-color mappings once per domain and reuse them across tables, cards, lists, and detail.
- Render status through **one composition** everywhere it appears — table cell, card header, list metadata, detail fact. A shared color map with per-page markup still drifts: one page grows a dot, another a bare badge, a third plain text.
- Active/published commonly means success, draft/archived neutral, a blocker warning, and a failure error; choose by meaning rather than by page.

## 8. Nuxt layouts and routing

UApp provides overlays and notifications. NuxtLayout provides the shared dashboard shell; NuxtPage renders route content. Put sidebar/navigation ownership in a layout, and entity-specific state in the relevant page/composable.

Use file-based routes and real nested pages for persistent detail sections. For example, `courses/[id].vue` owns the course heading and renders NuxtPage; `courses/[id]/index.vue` and `courses/[id]/students.vue` are Overview and Students. Section links must support direct URLs, reload, and browser back/forward.

### Native dashboard navigation

- Use UDashboardGroup, UDashboardSidebar, UDashboardNavbar and UDashboardPanel.
- Use UNavigationMenu groups and children for collapsible sections.
- Preserve access to child links when the sidebar is collapsed.
- Mobile navigation closes after choosing a destination.
- The sidebar footer carries appearance and account in that order: the controls that change how the shell looks on one row, the account menu beneath them. Both reduce to icon-only triggers with tooltips when the sidebar collapses, and neither becomes unreachable.
- Appearance controls are shell chrome, not page content. They live once in the layout footer; a page does not grow its own theme switch.
- Show a clear missing-record state rather than a broken detail page.

### Group by domain; badge with purpose

- Group related workflows beneath their domain: Courses contains Catalog, Sections, and Requests.
- Count badges may show useful destination context (Students 12) or actionable queues (Requests 4); ordinary counts stay neutral, and attention styling is reserved for meaningful exceptions.
- Do not badge every destination.
- Namespace modal query keys on child pages (for example, `assessmentEdit`) so a child editor cannot accidentally open its parent's editor.

### Child-route tabs and local tab panels

#### Place section links beneath the entity header

- Use a horizontal, tab-like strip immediately beneath the persistent entity header for peer sections such as **Overview · Students · Assessments**, or **Overview · Participants · Schedule**.
- Keep labels short and stable, inactive links neutral, and the active destination accented with a quiet native active treatment.
- Turn on UNavigationMenu's native `highlight` so the active section carries a moving indicator — an underline in horizontal orientation — rather than a color change alone. On a strip of short peer labels, color by itself is a weak signal, and this indicator is the one per-type accent that consistently earns its pixels.
- Do not simulate tabs with separately styled solid/outline buttons.

#### Route links, not hidden panels

- These are real child-route links, not a local `ref` switching hidden page-sized panels.
- Prefer horizontal **UNavigationMenu with `to` items**, normally in UDashboardToolbar.
- The route controls the active item; Overview uses exact matching so it is not active for every descendant.
- Preserve direct loading, refresh, Back/Forward, and copy-link/open-in-new-tab behavior.
- Do not wrap a link inside a tab button.

Ownership under `app/`:

```text
app.vue                         UApp → NuxtLayout → NuxtPage
layouts/dashboard.vue           shared sidebar and theme controls
pages/courses/index.vue         catalog
pages/courses/sections.vue      section workflow
pages/courses/requests.vue      request workflow
pages/courses/[id].vue          entity header, section links, NuxtPage
pages/courses/[id]/index.vue    Overview content
pages/courses/[id]/students.vue Students content
pages/courses/[id]/assessments.vue Assessments content
```

Minimal section-navigation composition in an entity parent that has loaded `entity`:

```vue
<UDashboardToolbar>
  <UNavigationMenu
    aria-label="Course sections"
    :items="[
      { label: 'Overview', to: `/courses/${entity.id}`, exact: true },
      { label: 'Students', to: `/courses/${entity.id}/students` },
      { label: 'Assessments', to: `/courses/${entity.id}/assessments` }
    ]"
  />
</UDashboardToolbar>
<NuxtPage />
```

#### Render shared chrome once

- The layout owns the shell, the parent owns the entity header/strip, and each child owns only its section and local actions.
- Do not repeat the H1 or tab strip inside children.
- Collection-level tabs are appropriate when sibling workflows genuinely share a parent; if adding such a parent, avoid stacking duplicate collection/entity headers on detail pages.
- Do not add another tab strip simply to repeat the sidebar.

On narrow screens keep the strip on one line, with contained horizontal scrolling when needed, comfortable targets, visible focus, and an active item that can be brought into view. Do not hide sections or make the whole page scroll horizontally.

#### Local panels are not routes

- Use **UTabs** for actual in-place panels, such as Preview/Code in a gallery example; retain its native tab/panel semantics and keyboard behavior.
- Use a select/view toggle for filtering or changing presentation of the same dataset. Alternate presentations are the same collection drawn differently: they share one search, filter, sort, selection, and pagination state. A card view that quietly drops the search and paging the table had is a second, weaker collection wearing a toggle.
- Page navigation, local panels, and dataset controls are different responsibilities.
- Avoid multiple nested tab strips; use sidebar groups or subpages for larger hierarchies.

### Breadcrumbs, collapse, and URL state

- Breadcrumbs describe the navigable hierarchy with human-readable entity names, not raw IDs.
- Ancestors link; the current location does not.
- **The trail begins at the first ancestor that has a destination.** A sidebar grouping label with no route of its own is never a crumb, and a collection root is its own last crumb rather than a repeated pair. Sibling pages under one parent therefore produce trails of the same shape — a rule that is merely permitted produces one shape per page, which is how a hierarchy stops being legible.
- A stable entity breadcrumb plus active child link is sufficient context on detail sections.
- Persist sidebar collapse, keep group order stable, and provide accessible names and hover/focus hints in icon-only mode.
- Native collapsed popovers preserve access to children; reproducing exact mockup pixel positions is not required.
- Only navigable state belongs in URLs: drafts, hover, and temporary menu state do not.

### Summary cards lead to real work

- Connect summary cards to working destinations and shared state.
- Capacity cards show occupied/available values with UProgress; exception cards identify the affected records and link to their resolution.
- Distribution summaries use aligned counts.
- Approving a request must recheck capacity and prerequisites, update the roster, and immediately refresh related counts.
- Do not present static demonstrations as actionable production controls.

## 9. Theme ownership

1. Define reusable font, spacing, and palette tokens in `app/assets/css/main.css` using Tailwind `@theme`.
2. Assign semantic colors and shared Nuxt UI component defaults in `app/app.config.ts`.
3. Put runtime Nuxt UI variables such as `--ui-radius` and mode-specific semantic shades in `:root` and `.dark`.
4. Scope a deliberate local variation with the native `UTheme` component, which overrides slots and prop defaults for its subtree only.
5. Use a composition's `ui` prop to customize native slots. Check the generated `.nuxt/ui/<component>.ts` for the installed version before changing slots.
6. Use ordinary layout utilities for grid, alignment, and responsive placement. Do not scatter arbitrary colors, spacing values, or deep selectors across pages.

The theme owns every rule that is a value rather than a decision: the type scale, page padding, table row height, touch sizing, radii, toast placement and limits, and the reduced-motion behavior of placeholders. Define each once here and no page can drift from it. A token that nothing references is not a convention — it is dead code that quietly disagrees with the utility actually in use, so reference the token or delete it.

### Palette and theme modes

- The example uses blue and slate, Public Sans with JetBrains Mono, compact radii, and restrained borders. Every one of those is replaceable.
- Typographic differentiation is the principle; mono is one way to express it. Whatever face marks machine-formatted values — schedules, timestamps, codes, ratios — must differ visibly from the face used for names and prose, and must never be applied to titles or prose itself.
- Replacing the palette must not change action semantics: whatever the accent becomes, it still marks the primary action, the active destination, and meaningful emphasis, and nothing else.
- Support light, dark, and system preference, and **default to system** where the platform reports one. A host that deliberately owns a single look may ship a fixed default, but system stays selectable.
- Review all three, including hover, disabled, and error states. A fixed default is precisely why system is the mode that ships broken.
- The resolved mode is unknown during server rendering, so any control that renders *from* the current preference — an icon-only appearance menu, a mode-dependent mark — belongs inside `ClientOnly` with a stable fallback. Reading `colorMode.preference` in server-rendered markup produces a hydration mismatch, and `system` is the value that exposes it.
- A palette swap has two documented traps. A custom color must define every shade from `50` to `950` before an alias can point at it, and a single value such as pure black or white cannot be a semantic alias at all — assign `--ui-primary` directly in `:root` and `.dark` instead.
- The focus outline is tinted per component `color` by default. An identity that wants one focus color everywhere sets it once, outside `@layer`, rather than per component.

### Making it yours

Identity is configured in two files and two narrowing scopes, in this order. Nothing below requires touching a component.

1. **`app/assets/css/main.css`** — `@theme` tokens: typefaces, the type scale, spacing, and any app-specific tokens. Then `:root` and `.dark` for `--ui-radius` and semantic shades. `--ui-radius` is a single knob for the whole scale: Nuxt UI redefines `rounded-sm` through `rounded-xl` as multiples of it, so ordinary radius utilities in application markup follow the host automatically and need no token of their own. Verify this in the generated CSS for the installed version rather than assuming it.
2. **`app/app.config.ts`** — `ui.colors` for semantic color aliases, and per-component `slots` / `variants` / `defaultVariants` for shared defaults.
3. **`UTheme`** — a subtree that genuinely differs, such as a preview frame or an embedded editor. It outranks the global config and is outranked by `ui` and `class`, so it changes a region without becoming a second global theme. Prefer it to repeating the same `ui` prop on every component inside one area.
4. **A composition's `ui` prop** — one-off slot overrides, where a single instance genuinely differs.

Each level merges onto the level above it. Where merging is the wrong answer — a default you must remove rather than outweigh — a slot accepts a function that receives the inherited classes and returns their replacement, which is still configuration rather than a deep selector.

Two deliberately opposite identities, both satisfying every Fixed rule:

```css
/* Trading desk: dense, hairline, near-square, figures in mono */
@theme static {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --text-data: 0.75rem;
  --text-page-title: 1.125rem;
  --spacing-page: 1rem;
}
:root { --ui-radius: 0.125rem; }
```

```ts
// app.config.ts
ui: {
  colors: { primary: 'teal', neutral: 'zinc' },
  table: { slots: { td: 'h-8 px-2 text-data tabular-nums' } },
}
```

```css
/* Campaign tracker: warm, rounded, a display face for titles */
@theme static {
  --font-sans: 'Alegreya Sans', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Cinzel', ui-serif, serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --text-data: 0.875rem;
  --text-page-title: 1.5rem;
  --spacing-page: 1.5rem;
}
:root { --ui-radius: 0.625rem; }
```

```ts
// app.config.ts
ui: {
  colors: { primary: 'amber', neutral: 'stone' },
  card: { slots: { root: 'shadow-sm ring-0' } },
}
```

Neither changes a component contract, a verb, a confirmation, a state, or a focus behavior. One is a spreadsheet that happens to be a web page; the other has parchment and small caps. Both pass the checklist.

The example application ships three such identities — its reference look, a campaign tracker, and a holiday-let console — switchable at runtime from the sidebar and documented on the Identity gallery page. Each is assembled from exactly the layers above: color aliases assigned at runtime, a token class carrying typefaces, type scale, page padding and `--ui-radius`, and a `UTheme` layer for shared component defaults. Put the token class on `<html>` rather than on a wrapper element, because overlays render in a portal outside it and would otherwise keep the values the identity replaced.

Before adding a token to carry some part of your identity, check whether the installed component library already routes that property through one of its own. Duplicating an existing knob replaces automatic inheritance with a value someone must remember to change twice.

**Where identity must not go.** Not into per-page style blocks, arbitrary one-off color and spacing literals, deep selectors reaching into component internals, or copied component source. Those do not produce identity — they produce an application whose appearance cannot be changed again. If a look cannot be expressed in the layers above, that is a reason to reconsider the look, or to add a token for it, before scattering it.

**The test for a host:** a stranger should be able to tell your application from the example at a glance, and operate it without learning anything new.

### Semantic text colors

- Typography colors are explicit: headings and record identity use `text-highlighted`; important values use `text-default`; labels use `text-muted`.
- Supporting metadata may use `text-muted` or `text-dimmed` for timestamps, secondary counts, and supporting lines when contrast remains readable.
- Do not dim a primary value merely because it is a number.
- Keep essential status and action information legible.

## 10. Accessibility and touch

### Keyboard, names, and touch targets

- All controls must be keyboard reachable, with a visible focus indicator.
- Use native links for navigation and native buttons for commands.
- Give icon-only buttons accessible names; show labels for fields and meaningful table headers.
- Use `md` as the recommended default for mobile buttons and form controls that support it. Check rendered target size and spacing for comfortable, accurate activation; the size label alone does not establish accessibility.
- Tooltips must not contain essential information unavailable on touch. Fixing an unreachable hint means giving it a focusable, named trigger — not promoting it to permanent visible text, which is a different design and usually a worse one.
- Keep content usable at 200% zoom and with reduced motion.

### Compact content; comfortable controls

- Keep compact content separate from comfortable targets: use 12px mobile page padding, tight metadata gaps, and compact metric grids without shrinking controls.
- Center icon-only buttons in both axes using Nuxt UI's native square variant; inspect the entire hover/focus background, not just the icon.
- When a Nuxt UI component offers a `size` prop, use it as the primary method of controlling size. Native size variants coordinate text, icons, padding, and embedded controls.
- Customize the meaning of size labels (`xs`, `sm`, `md`, `lg`, `xl`, and any supported alternatives) in that component's global `app.config.ts` configuration so equivalent controls stay consistent throughout the app. Set the usual size with `defaultVariants.size`; keep any deliberate responsive size-variant styling there too, rather than adding per-instance dimension overrides.
- Avoid specific dimensions that stretch controls independently of their content. For components without a size prop, use their native theme slots and shared configuration, adjusting spacing and alignment together.
- Inspect icon-only buttons, adjacent actions, and embedded input controls at mobile widths. Increase native size or surrounding spacing when needed; preserve non-overlapping targets and readable input text.
- Avoid repeating a long description in a collapsed mobile row when expansion already provides it.

### Recoverable and understandable states

- Touch targets must not overlap adjacent targets.
- Follow section 5's loading and pending rules, including scoped busy feedback and reduced motion.
- Use UEmpty for resolved no-records or no-matches results; field errors for validation; persistent nearby errors for failed saves/confirmation.
- A collection composition must **let its host supply the creation action** for an empty result. A wrapper that hard-codes "No records yet" with nothing to do next does not merely miss this rule, it prevents every host that copies it from meeting the rule.
- Disabled controls need an understandable reason where it is not apparent. A native `disabled` control fires no hover or focus events, so a tooltip attached to it can never open and is not a way to supply that reason. Either state the reason in adjacent visible text, or keep the control focusable with `aria-disabled`, an accessible name carrying the reason, and a guarded handler.
- Missing/deleted entities get an unavailable state and a valid route to the collection.
- Test all these states in both themes, not only the happy path.

## 11. Copying the toolkit

### Installation and copy set

- Copy only the required files from `example-app/app/components/kit`, preserving their explicit local imports.
- DataTable also needs its CSV utility.
- Install the dependency versions recorded by the example's package manifest/lockfile.
- Enable `@nuxt/ui`, import Tailwind and Nuxt UI CSS, and wrap the application in UApp.
- Install the icon collection and enable client-bundle scanning. Without it a host bundles only the icons the component library itself references and silently fetches the rest from a public API at runtime — check the bundle rather than assuming, since the icons still render either way.
- Merge theme settings into the host's existing configuration; do not overwrite it wholesale.

### Public inputs, not hidden dependencies

- The kit accepts props, slots, native table columns, and callbacks.
- It must not import the demo store or assume courses, games, or routes.
- Entity form callers provide state, schema, and async save.
- The app README documents each copy set and public contract.

### Zero demo records in reusable components

- Reusable components contain **zero example records**.
- Keep fixtures in dedicated demo data or small gallery previews, never inside the portable kit.
- Pages/domain adapters own route parameters, store/service access, and action wiring; stores/services own shared data and business rules; presentation components receive view models and callbacks.
- A domain component that imports a course store is application code, not automatically a portable card.
- When advertising such a component as portable, remove hidden store dependencies first.

### Document the contract; centralize styling

- Document each copy set's props, slots, events, async failures, utilities, theme requirements, and router dependency where applicable.
- Functionality may be portable while exact appearance still requires merging shared tokens/defaults.
- Do not replace the host configuration wholesale.
- Use minimal page-specific CSS: ordinary layout utilities are appropriate, but shared styling belongs in theme/config, and wrapper-specific styling uses native `ui` slots.
- Avoid per-page style blocks, inline design literals, deep selectors, or copied native component source to establish reusable styling.

### A small toolkit, not a wrapper quota

- Prefer a small composition toolkit: PageHeader, DataTable, ListItem, ConfirmButton, EntityForm, ActionMenu, DetailPanel, StatCard, InlineStatus, EmptyState and table-specific FilterBar/BulkActionBar compositions when independently reusable.
- Do not create an extra component solely to reach a target count.
- UEmpty, UBadge, UProgress, UAccordion and the other native primitives remain the implementation foundation.
- Domain Undo and route-query orchestration are application logic, not replacement component engines.

The names below describe responsibilities, not a requirement to import the example's implementations:

| Composition | Public responsibility |
| --- | --- |
| PageHeader | Title, optional count, breadcrumb items, responsive actions slot; composes native dashboard header |
| ListItem | Supplied identity/link, metadata, leading/actions slots, selection and expansion models; row/card presentations |
| DataTable | Supplied records, native columns/slots/API, title/link callbacks, bulk callbacks, card/table presentation, resolved empty-state contract, focus fallback, and CSV utility |
| ConfirmButton | Prompt/consequence, async action, pending/error state, cancellation, completion and focus restoration |
| EntityForm | Create/edit modal or page shell, supplied fields/state/save callback and submission feedback; optional protected-editor contract documented with the example |
| ActionMenu | Supplied record name/link and action callbacks; consistent menu order and confirmation handoff |
| DetailPanel | Supplied heading and label/value facts, optional actions and value slots |
| StatCard | Supplied label/value, optional genuine delta/progress and supporting content |
| InlineStatus | Supplied status label and semantic color; composes UBadge rather than a custom pill |

### Do not wrap without a reason

- Use UEmpty directly unless a repeated application-specific empty-state contract warrants a wrapper.
- Filters and bulk controls may stay inside DataTable; no separate wrapper is required.
- Loading/errors are interaction state, not example data.
- Keep domain status mappings and business validation outside generic presentation components.

## 12. Where each rule lives

Before adding a rule here, decide which layer can carry it. A rule that a component or the theme can enforce should not be left to a reader's memory: in practice the rules that get followed are the ones nobody has to remember.

| Layer | Carries | Examples |
| --- | --- | --- |
| Composition | Rules a host cannot get wrong once it uses the component | Variant contract, confirmation by risk, focus restoration, empty-state contract, action vocabulary and order, CSV escaping |
| Theme | Rules that are a value, not a decision — and where a host's identity lives | Type scale, touch targets, row height, radii, palette, typefaces, reduced motion, toast placement and limits |
| This document | Rules that genuinely need judgment | Which container fits the relationship, what to name things, whether a label matches its destination, when density helps |

Two consequences. A composition that *prevents* compliance is worse than a page that merely fails it, because every host copying that composition inherits the failure — fix the component first. And a rule stated here with no named implementation site will be unimplemented everywhere; give it one, or drop it.

### Rules a check can catch

Keep the mechanical subset out of human review:

- No `toast.clear()` in application code.
- No `title` attribute used as a tooltip; no tooltip as the sole carrier of a disabled control's reason.
- Every icon-only button has an accessible name.
- No page-level type utility larger than the page-title token outside a metric value.
- Every collection composition that can destroy its trigger accepts a focus fallback.
- Sibling pages under one parent produce breadcrumb trails of the same depth and root.

## 13. Review checklist

Start with the common user journey and presentation. Apply the remaining checks to changed behavior; this is not a requirement to retrofit every subsystem during a focused UI task.

### Confirm the work before reporting it

Making the change is not finishing it. A change is finished when it has been checked against this guide and against the host's own identity, by examining the result rather than recalling the intent. Run this pass every time, before reporting anything as done.

1. **Re-read the sections the change actually touched** — not the whole guide, and not from memory. The review map exists so this stays cheap.
2. **Look at the rendered result**, at desktop and narrow widths and in both themes. A rule present in the source is not a rule visible on the page: grounds, contrast, spacing, and overflow all fail silently, and type checking, linting, and a successful build are not visual or accessibility verification.
3. **Walk the checklist below** for the areas changed, deliberately including the visual-contrast and explanatory-prose questions. Those two are the most often skipped, because a flat, wordy page raises no error anywhere.
4. **Compare the change to the host's established identity and patterns**, not only to this document. A change that satisfies every rule here and looks nothing like the rest of the application has still failed.
5. **State what was checked, what was not, and what was found and left unfixed.** Record gaps rather than describing checks that did not happen.

### The checks

- Can users complete the main task with discoverable controls and no unnecessary steps, prompts, or disabled dead ends?
- Do spacing, alignment, typography, grouping, and responsive composition make the page clear and polished?
- Can users identify the page, primary record, and next action without explanatory prose?
- Are cards, lists, and tables chosen for the information relationship?
- Does the page have visual contrast that carries meaning — supporting surfaces receding, exceptions marked, destinations and repeated concepts iconed, people shown as people — or is it uniformly flat?
- Is each piece of meaning carried by the most direct instrument available — status as a badge, proportion as a progress element, a person as an avatar and a name, a destination as an icon with its label, parallel facts as aligned rows or a table — rather than described in a sentence because a sentence was faster to write?
- Is every per-type signal applied to its whole class — a full row of metric cards, every destination in a menu — rather than to a favoured member of it?
- Does the application look like itself rather than like the example, and is that identity expressed in theme tokens and shared defaults rather than scattered per-page overrides?
- If the application has a patterned or gradient ground, does every surface carrying text — cards, tables, list rows, inputs, menus, popovers — have a flat background of its own, including the *quiet* variants a component library ships translucent?
- Does the application have character of its own — ground, texture, face, ornament, something under the cursor — or would a reader call it competent and dead?
- Does that character stay out of the resting layer where signals live, sitting on the shell or on interaction rather than as a permanent mark on every card, and is it defined once in the theme rather than copied per page?
- Are variants, vocabulary, icon behavior, and confirmation consistent?
- Does every color on the page name a state or a role, with neutral doing the work wherever there is no such claim to make — and does each confirmation sit in the container its consequence actually requires?
- Where forms are involved, are related fields and validation consistent, and does recovery follow section 6? Do prompts protect meaningful work without interrupting routine actions?
- Can the page be scanned, or has explanation become its content — and is each surviving line there because a label could not carry it?
- Do loading, empty, no-results, pending, and failure states work?
- Do first-load skeletons preserve layout, refreshes retain context, and child-route loading leave shared navigation intact?
- Are busy states scoped and accessible, reduced motion respected, conflicting actions blocked, and failure/retry paths free of stuck indicators or misleading stale results?
- Does an empty collection offer creation, a filtered-out one offer recovery, and does the composition let the host supply both?
- Does every action that removes its own trigger — including bulk actions — leave focus somewhere sensible?
- Do alternate presentations of one collection share its search, sort, selection, and pagination?
- Is status drawn by the same composition on every surface, and does each button's label match where it actually goes?
- Do mobile and desktop expose equivalent operations?
- Do child-route links load directly and survive refresh, Back/Forward, mobile overflow, and exact Overview matching?
- Do local UTabs panels retain native keyboard semantics without masquerading as route navigation?
- Do collapsed/mobile navigation, keyboard controls, tooltip/menu composition, and focus restoration work?
- Can representative kit components be copied into a clean compatible host without demo imports, with their theme/dependency requirements documented?
- Do filters, sorting, selection, expansion, pagination and CSV export work together and preserve state across viewport changes?
- Have type checking, linting, focused behavior tests, and a production build passed for application-code changes?
- Has the finished result been viewed in a browser and re-checked against the sections it touches and the host's existing patterns, with anything found and left unfixed reported as a gap?

### Verify the implementation, not just the document

- Cross-check the guide, gallery, and implementation.
- A written rule is not proof of implementation: record gaps rather than silently changing the specification to match incidental code.
- The gallery documents every supported toolkit variant with live examples, rule, rationale, props/slots/events, dependencies, and copyable usage; link to native documentation for other upstream options.
- Production example pages remain concise.
- Example data is fictional, in memory, and resets on refresh; no backend is implied.

## Sources and baseline

### Reference boundaries

- Visual inspiration: the read-only `External UI Design System/Design Guidelines.dc.html`.
- Its absolutes are reconciled here: meaningful labels/validation remain allowed; confirmation containers are chosen by what must be shown rather than by a fixed action list; real links implement route tabs; local UTabs panels remain useful; and native primitives do not require a redundant wrapper.
- No reference file is needed to apply this guide.

- [Nuxt UI Dashboard template](https://github.com/nuxt-ui-templates/dashboard), baseline commit `7f62b754af4c9e34aa7521ed44371ac95332c8cc`.
- [Nuxt UI Table](https://ui.nuxt.com/docs/components/table), [Popover](https://ui.nuxt.com/docs/components/popover), [NavigationMenu](https://ui.nuxt.com/docs/components/navigation-menu).
- [Nuxt 4 nested pages](https://nuxt.com/docs/4.x/directory-structure/app/pages).
- [Nuxt UI Tabs](https://ui.nuxt.com/docs/components/tabs), [Tooltip](https://ui.nuxt.com/docs/components/tooltip).

### Pinned example baseline

- Recorded example baseline: Nuxt 4.5.2, Nuxt UI 4.11.0, Vue 3.5.42, Tailwind CSS 4.3.3, and TanStack Vue Table 8.21.3.
- These identify the example, not universal minimum versions.
- Pin exact dependencies in each host and check installed component types/generated themes before assuming APIs.
- This guide defines chosen design conventions; upstream documentation defines supported APIs.

The gallery renders this exact Markdown source. Gallery annotations explain implementation choices; example application pages keep the production experience concise.
