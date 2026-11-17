# Video.js migration

## Scope and decisions

Baseline: `93958b1`, including merged PWA support. Preserve prompt registration,
NetworkOnly document fallback, exclusion of API/media/range requests from caches,
and no skip-waiting, client claiming, or automatic Nuxt reload.

The user selected packaged Neutral audio/video skins with a gold accent, retaining
the compact persistent player, drawer and page dock. Preserve recap links, saved
positions and recent selection; the active queue should continue across navigation.

## Current upstream research (2026-11-16)

Registry and installed package: `@videojs/html` **10.5.0**, pinned with pnpm 12.21.0.
The v10 API is custom elements, not the legacy imperative `videojs()` API.

- [Vue/Nuxt](https://videojs.org/docs/framework/html/guides/vue): exact custom tag
  compiler configuration, client registration, mounted store subscriptions.
- [Skins](https://videojs.org/docs/framework/html/guides/skins) and
  [customization](https://videojs.org/docs/framework/html/guides/customize-skins):
  Default, Neutral, Compat, Scaffold; Neutral has the full controls and documented
  accent/font/radius properties. Keep packaged internals upstream-owned.
- [Migration](https://videojs.org/docs/framework/html/guides/migrate-from-video-js-8):
  no playlist equivalent or automatic preference persistence. Existing app-owned
  recap queue/progress remains necessary; do not install legacy v8 plugins.
- [Vidstack migration](https://videojs.org/docs/framework/html/guides/migrate-from-vidstack):
  no Media Session metadata integration. The metadata feature resolves display
  title/poster only; use a small browser Media Session adapter.
- [Errors](https://videojs.org/docs/framework/html/guides/playback-errors): skins
  own error presentation; recovery is app-owned. No automatic retry loop.
- [Accessibility](https://videojs.org/docs/framework/html/guides/accessibility),
  [keyboard/touch](https://videojs.org/docs/framework/html/guides/keyboard-shortcuts),
  [fullscreen](https://videojs.org/docs/framework/html/guides/fullscreen): packaged
  controls include ARIA, status announcements, scoped shortcuts and gestures;
  fullscreen falls back to native video UI on iPhone, with platform limits.
- [Lifecycle](https://videojs.org/docs/framework/html/reference/components/player):
  keep-alive preserves the player during moves; dispose explicitly at final teardown.

Version-matched documentation is also shipped in `node_modules/@videojs/html/docs`.
No transcoding, media derivatives, offline downloads or server redesign is included.

## Validation

Production browser testing found two integration causes that mocked media cannot
establish: Nuxt purges a watch route's async data after unmount (so a queue resolver
must retain the loaded private artifact identities), and Vaul captures pointers
on the shadow-root skin host when dragging the drawer body, preventing Video.js
buttons from receiving pointer-up. Use the drawer's native handle-only setting
instead of patching the player controls or pointer APIs.

Automated validation completed against the migrated player:

- `pnpm install --frozen-lockfile --ignore-scripts`: lockfile accepted with pnpm 12.21.0.
- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test`: **87 files, 356 tests passed**, including private/public stream
  authorization/range tests and the queue-disposal regression.
- `pnpm build`: passed. Dependency
  annotation warnings from Zod remain non-fatal.
- `pnpm test:pwa`: **2 production Chromium workflows passed**. Installation,
  limited cache contents, offline boundaries, multi-tab waiting updates, unsaved
  drafts and uninterrupted playback passed. The media workflow covers real audio
  and video, source replacement without simultaneous players, navigation, drawer
  controls, automatic next, Media Session seek/next handlers, resume after reload,
  fullscreen, caption cues/selection, failed-stream Retry, public playback/ranges
  and private artifact denial. A final focused run also passed with an assertion
  against unhandled page errors.
- Reviewed production screenshots at 1280px and 390px, light/dark. The controls
  and drawer fit without horizontal page overflow. At compact sizes, captions
  are selected through the skin's Settings menu.
- Interactive shared-browser checks additionally confirmed that the same audio
  element keeps playing through dock → compact → drawer moves, without pause,
  loadstart or emptied events. Pointer tracing confirmed the Vaul capture cause;
  no diagnostic patches to browser APIs or dependency files are retained.

The user selected Neutral skins, a persistent recap queue, and a visible native
drawer grab handle with dragging restricted to that handle. Minimize remains
available; `handle-only` prevents body dragging from stealing Video.js input.
No push, deployment or PR was performed.

The selected visible-handle configuration was revalidated on 2026-11-17:
lint, typecheck, all five focused media tests, production build (2m 49s) and both
production PWA/browser workflows passed. The browser workflow now drags the native
handle to dismiss the drawer and asserts that audio remains playing with no pause
event, before exercising video fullscreen and the remaining controls. Reviewed
the updated narrow-screen rendering with the handle visible.

Physical iOS/Android browser and installed-PWA checks remain necessary for screen
lock, app switching, headset delivery, fullscreen/rotation, interruptions and
background queue advancement. Desktop Media Session handler invocation and
responsive screenshots do not establish these physical-device behaviors.

Physical acceptance pass (not established by desktop emulation):

- On iPhone Safari, an installed iOS PWA, Android Chrome and an installed Android
  PWA, start both media kinds with a tap. Lock/unlock and switch apps; record
  continuation and position recovery rather than assuming OS behavior.
- Use lock-screen and wired/Bluetooth headset controls for play, pause, seek and
  track changes where exposed. Check title, artwork and position.
- Let audio→video and video→audio recap transitions finish while foregrounded,
  locked and backgrounded. Repeat with automatic advancement off and after
  connectivity loss; a policy refusal must leave a visible recovery action.
- Enter/exit native or element fullscreen, rotate, return from PiP if offered,
  and use the drawer controls/sliders with touch. Check focus, 200% zoom,
  reduced motion, safe areas and long titles.
- Interrupt playback with a call, voice assistant or headset disconnection;
  check the actual pause/resume state on returning. Save drafts before closing
  all app clients to apply a waiting update.
