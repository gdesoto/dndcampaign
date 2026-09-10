# Session workspace ownership

## Investigation

The route tree is campaign parent → session parent → overview or workflow step.
The session parent owns the header, edit modal, and navigation; its `NuxtPage`
renders `index.vue` or `[step].vue`. Previously all three routes called
`useSessionWorkspaceViewModel()` independently. A mounted session therefore had
two workflow instances, and switching children constructed another instance.

Nuxt async-data keys shared the fetched workspace, but did not share the local
summary draft, file selections, busy flags, playback caches, or recap kind.
The job composable used keyed `useState`, so separate view models also installed
watchers over the same selected-job state. The flat return object concealed these
different lifetimes and repeated most feature exports in the child pages.

The old async view model awaited the resource and then awaited five synchronous
feature composables through `runWithContext`. Nuxt application context does not
substitute for Vue component/effect ownership. Creating feature watchers
synchronously in the parent's setup makes their cleanup follow that parent.

## Ownership and lifetime

1. The parent pins campaign/session IDs at creation and awaits `useSessionWorkspace`.
2. Back in the parent's compiled `script setup`, it synchronously constructs the
   view model and provides it under a typed `InjectionKey`.
3. Children synchronously inject that instance. A missing provider is an error,
   never a reason to silently create a second workspace.
4. The parent's explicit key includes campaign and session identity, not the step
   or query string. Step navigation keeps the instance; changing sessions replaces it.
5. Pinned IDs also keep outgoing asynchronous actions tied to their originating
   session while Nuxt's old and incoming suspense trees may coexist.

The context groups resource data, session editing, recordings, recap, transcript,
summary, suggestions, overview metrics, and navigation. Feature groups are reactive
objects so child template assignments update the original refs. Existing panel
prop/event contracts stay explicit; panels do not need knowledge of the context.
The edit-modal visibility is local to its owning parent rather than global state.
The unused checklist and unused normalized section state were deleted.

## Draft and navigation behavior

The summary draft now survives movement between workflow steps and Overview.
Its unsaved-change guard lives in the parent, so moving to Overview cannot remove
the guard while retaining a dirty draft. `useUnsavedChanges` accepts an optional
scope predicate: navigation within the same session is allowed; leaving that
session still checks dirty/busy state. Browser close/reload protection remains
active regardless of the visible step. Other users of the guard retain its
original behavior. The session edit modal keeps its own existing protections.

Server refreshes still merge through `useEditorDraft`, preserving locally changed
summary fields when the parent saves session metadata. Failed refreshes retain
the exact session's previous resource. A new session starts with new local drafts,
files, errors, and action flags rather than manually resetting every field.

## Deliberate boundaries

The parent owns one combined session jobs resource. Both job views select their
latest job directly from that response; only historical selections fetch details.
Historical responses must match the selected ID before display, and refreshes
retain previous results on failure. The endpoint reads ordered history and then
details for at most two latest jobs, preserving its existing response contract.
Existing global media playback and
session-keyed job selection caches keep their established lifetimes. Standalone
document and recording editor routes remain outside the session parent.

The change does not add a Pinia store, keep-alive cache, or automatic fallback
factory. Ancestor ownership already provides the lifetime needed here.

## Verification

`test/nuxt/session-workspace-routes.test.ts` exercises real nested `NuxtPage`
navigation with mocked API responses and lightweight panel stubs. It checks shared
identity/request counts, draft preservation across steps and refreshes, guarded
session changes, clean state for the next session, and disposal of old job watchers.
Existing session panel, playback, suggestion, and deletion tests cover the retained
feature contracts. Typecheck and lint validate grouped template bindings.

## References

- [NuxtPage: nested routes, keys, and Suspense](https://nuxt.com/docs/4.x/api/components/nuxt-page)
- [Vue provide/inject and reactive values](https://vuejs.org/guide/components/provide-inject)
- [Vue watcher ownership and disposal](https://vuejs.org/guide/essentials/watchers.html)
- Installed Nuxt implementation: `node_modules/nuxt/dist/pages/runtime/utils.js`
  (`generateRouteKey`) and `page.js` (route provider and suspense handling).
