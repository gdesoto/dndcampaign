# Verify the host change

Start with the common user journey and presentation. Scale checks to the change; exercise only relevant areas, and do not turn a focused UI task into a form-infrastructure retrofit. For application-code changes run host type checking, lint, relevant behavior tests, and production build where available. Check installed APIs rather than treating snapshot versions as current upstream advice.

Inspect changed interactions in a browser at desktop and narrow mobile widths, in light/dark themes. HTTP 200 from a SPA proves only shell delivery. Do not claim browser verification without a browser pass.

| Area | Exercise |
| --- | --- |
| User journey | Purpose and next action apparent; discoverable navigation; efficient completion; no unnecessary prompts, steps, or disabled dead ends |
| Presentation | Hierarchy, spacing, alignment, typography, grouping, visual character, and responsive composition; useful information remains easy to scan |
| Forms, when changed | Clear fields and errors; unchanged-edit Save gating by default; invalid-submit behavior makes errors discoverable; failed save retains input; expected completion/Cancel behavior; prompts only where meaningful work could be lost without recovery |
| Confirmation, when warranted | Container matches what must be shown (sentence versus count/cascade/pending); initial Cancel focus; duplicate/conflicting action protection; failed prompt stays open; removal restores meaningful focus |
| Collections | Filter/search resets page and selection; sort/selection across pages/expansion/visibility; shared state across viewport/view changes; empty versus no matches and recovery |
| CSV | Visible data columns; filtered/sorted rows across pages or selected filtered rows; commas, quotes, newlines and formula-looking strings; actual downloaded contents |
| Requests | First load, contextual refresh, rejection/retry, resolved empty; no mislabeled stale results or stuck pending states |
| Routes | Direct child/editor URL, refresh, Back/Forward, exact Overview, unrelated queries, isolated child editors, missing-record recovery |
| Accessibility | Keyboard names/focus, field validation, textual status, touch spacing, 200% zoom, reduced motion, long titles and contained overflow |
| Shell | Collapsed child links, mobile navigation close, one persistent header, portal theme inheritance, toasts clear of mobile actions |
| Portability | Local imports resolve without demo code; theme roles exist; SSR/hydration if enabled; icon bundle meets host requirements |

Check for blanket `toast.clear()`, HTML `title` used as a tooltip, icon controls without names, oversized secondary headings, lost focus after bulk actions, and inconsistent breadcrumb roots. Interpret findings in context; do not enforce a wrapper count or fixed visual skin.

Record discrepancies between specification and implementation as gaps. Do not weaken the specification to bless incidental example behavior or treat a build as visual/accessibility verification.
