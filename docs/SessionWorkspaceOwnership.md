# Session workspace ownership

The route tree is campaign parent → session parent → Overview or workflow step.
The session parent owns the header, edit modal, navigation, and one workspace
instance. Its nested page renders the selected child view, which shares that
instance through a typed injection context.

## Ownership and lifetime

The parent pins campaign/session IDs when it is created and loads the session
resource with `useSessionWorkspace`. It constructs the view model and feature
watchers synchronously in its setup, so their disposal follows the parent.
Child pages inject the provided instance; a missing provider raises an error.

The parent's route key includes campaign and session identity, excluding the
workflow step and query string. Moving between steps preserves the instance.
Changing sessions replaces it. Pinned IDs keep outgoing asynchronous actions
associated with their original session while old and incoming route trees
overlap during navigation.

The context groups resource data, session editing, recordings, recap, transcript,
summary, suggestions, overview metrics, and navigation. Reactive feature groups
let child template assignments update the original refs. Panel props and events
remain explicit, and edit-modal visibility belongs to the parent.

## Drafts and navigation

The summary draft survives movement between workflow steps and Overview.
Its unsaved-change guard lives in the session parent. Same-session navigation
is allowed; leaving the session checks dirty/busy state. Browser close/reload
protection remains active regardless of the visible step. The edit modal has
its own draft protections.

Native link and button destinations drive session navigation. Panels receive
their destinations directly. Invalid step URLs resolve to the workflow fallback.

The transcript panel creates an empty document only when one is missing and
uses the standalone editor for content changes. Creation, import, and deletion
share a busy guard; pending state and errors survive step navigation.

Server refreshes merge through `useEditorDraft`, retaining changed summary
fields when session metadata is saved. Failed resource refreshes retain the
previous data for that exact session. A new session starts with fresh drafts,
file selections, errors, and action flags.

## Jobs and playback

The parent owns one combined session jobs resource. Latest-job views select
directly from it; historical selections fetch details separately. Historical
results are displayed only when their identity matches the selected job.
Refresh failures retain previous results. The endpoint reads ordered history
and details for at most the two latest jobs. Generation and review are described
in [SessionJobs.md](SessionJobs.md).

Private playback uses artifact stream URLs from loaded media identity. Panels
derive playing/pending indicators from the global player's source, artifact URL,
media kind, and actual state. The global player owns playback failures and Retry.
Upload and deletion retain their own action state.

Global media playback and session-keyed job selection caches outlive individual
workflow panels. Replacing media under the same recap ID uses its new artifact
URL. Successful deletion stops playback only if ID, URL, and media kind still
identify the deleted source, preserving a newer selection.

Standalone document and recording editor routes sit outside the session parent.

## Source references

- [Workspace resource](../app/composables/useSessionWorkspace.ts),
  [view model](../app/composables/useSessionWorkspaceViewModel.ts), and
  [injection context](../app/composables/useSessionWorkspaceContext.ts).
- [Session jobs composable](../app/composables/useSessionJobs.ts).
- [Route behavior tests](../test/nuxt/session-workspace-routes.test.ts): shared
  identity, retained drafts, guarded session changes, and watcher disposal.
