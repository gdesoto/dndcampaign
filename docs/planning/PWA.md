# PWA implementation and validation

## Decisions

- Inspected current AGENTS.md, setup, style guide, session ownership, and the
  centralized gstack UI skill. The myLHSWeb Nuxt config and OutdatedAlert component
  were inspected read-only. Reused standalone manifest and Apple icon conventions;
  adapted branding from DM Vault's existing favicon. Its auto-update and broad
  caching configuration are unsuitable for this application's private data and
  long-lived players/editors.
- Installed `@vite-pwa/nuxt` 2.0.1 using pinned pnpm 12.21.0. Current registry
  metadata and the installed module declare Nuxt `>=3.9.0`; the installed module
  README explicitly includes Nuxt 4. DM Vault resolves Nuxt 4.6.4 and Vite 8.3.8.
  Version 2 uses `generateSW`; older documentation calls this `workbox`.
  Sources: [module source](https://github.com/vite-pwa/nuxt/blob/main/packages/module/src/module.ts),
  [package metadata](https://github.com/vite-pwa/nuxt/blob/main/packages/module/package.json),
  and [module guide](https://unplugin-pwa.netlify.app/frameworks/nuxt).
- Public build identity metadata makes each production release detectable without
  caching private HTML, payloads, or data. Keep the offline HTML URL intact instead
  of the module's default extension-removing transform. Explicitly disable its
  default navigation shell fallback. Only failed document navigations receive the
  generic fallback; API and Range requests do not.
- Passive waiting-worker lifecycle protects all tabs and windows without adding a
  parallel global draft registry. No skip-waiting call or automatic reload is
  exposed. Nuxt's built-in chunk/new-build reload is set to manual, with the same
  notice for its build and chunk-error hooks. Existing player and draft ownership
  is unchanged.
- Initial full tests exposed the module's virtual registration import failing in
  Windows Vitest/Happy DOM (`file:///@unplugin-pwa/virtual:pwa-register/vue`). Disable
  registration only in the simulated Nuxt test environment; the production
  Playwright suite exercises the real service worker.

## Validation

Verified locally on Windows with Node 24.19.0 and pnpm 12.21.0:

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed on the final source. |
| `pnpm typecheck` | Passed on the final source. |
| `pnpm test` | 87 files, 356 tests passed across unit, Nuxt, and API projects. Includes recording/recap range and authorization coverage. |
| `pnpm build` | Passed with production service-worker generation: eight public precache entries, 80.09 KiB. No PWA generation warnings. Existing upstream Zod/Rollup annotation warnings remain. |
| `pnpm test:pwa` | Passed against the final production build (18.9 seconds total). Uses an isolated seeded database and artifact storage. |
| Visual review | Inspected screenshots at 1280px and 390px in dark/light themes, plus the static offline page and maskable icon. Corrected translucent notices and enlarged close targets. |

The production Chromium check verified:

- Chrome reports no installability errors; the manifest, Apple metadata, PNG
  dimensions, and opaque icon backgrounds match the intended configuration.
- A controlled page streams a real uploaded WAV through the artifact endpoint;
  its Range request returns HTTP 206 with the exact bytes and Content-Range.
- A waiting worker leaves native audio playing and an unsaved session title in
  another tab intact. Both documents retain their original time origins.
- Dismissing the notice does not activate the update. Closing just the player
  tab leaves it waiting; closing the editor as well allows activation. Reopening
  succeeds without another update notice. The test restores the generated worker.
- Offline API and artifact fetches fail as network requests rather than receiving
  cached private data or offline HTML. An offline private document navigation
  shows only the generic static notice. Reconnection clears the in-app notice.
- Cache Storage contains only the offline notice, favicon, four branding PNGs,
  manifest, and public build metadata. No application pages, API data, payloads,
  recording bytes, or artifact streams appear there.

An earlier full run had a journal test cold-start timeout and a new hook test
that asserted before Vue's next render tick. The hook test now waits for the
render; the journal test passed on rerun without a change, and the final complete
suite passed. No test timeouts were increased.

Physical-device checks remain unperformed: iOS/Android installation, browser versus
standalone behavior, screen lock, app switching, next-episode autoplay, and video
fullscreen/rotation. Chromium automation does not prove background playback.
The checklist and platform limits are in
[the implemented guide](../PWA.md#playback-limits-and-device-checks).
myLHSWeb was inspected read-only.
