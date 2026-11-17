# Installation and mobile playback

DM Vault uses `@vite-pwa/nuxt` to provide a web manifest, standalone installation,
DM Vault icons (including maskable and Apple touch artwork), a service worker,
and connection/update feedback. Production installation requires HTTPS; localhost
is supported for development testing. The service worker is disabled in `pnpm dev`.

Use Chrome's **Install app** menu on Android/desktop, or **Share → Add to Home
Screen** in Safari on iPhone/iPad. Available install controls depend on the browser.
The manifest launches `/`, where the existing authentication flow chooses the
appropriate destination. Installation does not bypass sign-in or campaign access.
Both portrait and landscape orientations remain available.

## Connection and privacy

An open page displays an offline notice and retains its existing state. Connection
status comes from the browser; a reachable network does not guarantee the server
is available. Existing request/player errors remain responsible for those failures.
Saving, campaign navigation, and media playback require a working connection.

The service worker precaches only the public offline notice, branding icons, web
manifest, and public Nuxt build identity metadata. Build metadata changes with each
production build so a new build can be detected without caching application data.
There is no cached application shell or offline campaign mode. Network failures on
document navigations show a static, generic offline page. Normal HTTP responses,
including authorization errors, are preserved.

Authenticated API responses, private HTML, Nuxt page payloads, and recording,
recap, image, and artifact streams are never stored in service-worker caches.
All API requests (including public media), non-navigation fetches, and Range
requests bypass runtime caching. The existing HTTP range streaming and native
audio/video player remain in use. This policy describes service-worker Cache
Storage; it does not replace ordinary HTTP caching or authentication policy.

## Updates and work in progress

The module registers the worker and checks for updates on opening the app and
hourly while it remains open and online. A waiting update displays **Update
available**. Save your work, finish listening, close **all** DM Vault browser tabs
and standalone windows, then reopen. A normal refresh may leave the update waiting
while a client still exists. On mobile, remove the standalone app from the app
switcher as well as closing its browser tabs if necessary.

Updates never invoke skip-waiting, claim existing clients, or reload an open page.
Nuxt's automatic new-build/route-chunk reload is also disabled. Build changes or
missing route chunks display the same notice; if a newly requested view cannot
load, save your current work and reopen the app when ready.
There is deliberately no force-update button: it could interrupt playback or
discard drafts in another tab. Dismissing the notice leaves the worker waiting.
Existing unsaved-change guards still apply to navigation and browser close/reload;
closing an app can lose unsaved input, so save before closing. Registration failure
has a separate dismissible notice and does not block online use.

## Playback limits and device checks

Installation can help [Chrome's autoplay policy](https://developer.chrome.com/blog/autoplay/)
through home-screen installation on mobile or PWA installation on desktop;
it does not grant native audio privileges or guarantee background playback.
Browser/OS policy, battery management, connectivity, and media type still apply.
No offline media downloads, Video.js player, audio-only derivatives, or background
playback entitlements are included.

Physical-device validation is required on iOS Safari and Android Chrome in both
browser and installed modes:

- Install/launch and sign in; inspect icon cropping, standalone chrome, portrait,
  landscape, and safe areas.
- Start audio and video recordings/recaps with a tap; pause/resume and seek to
  confirm range loading, including after reconnecting.
- Lock/unlock the screen, switch apps, and return; record whether playback
  continues and whether controls and position recover.
- Let a recap finish and test the next episode, including while locked or in
  another app; autoplay rules can require a new user gesture.
- Enter/exit video fullscreen and rotate; check controls and playback continuity.
- Leave a player and an unsaved editor open in separate tabs/windows, make a new
  build available, and verify the update waits without reloading either. Save,
  close every client, reopen, and verify the new version.

Automated Chromium checks cannot establish mobile background behavior or platform
installation UX. See the [implementation validation record](planning/PWA.md).

## Maintenance

Regenerate committed PNG icons from `public/favicon.svg` with
`node scripts/pwa-icons.mjs` (uses the existing Sharp dependency). Maskable artwork
has an opaque background and inset content for launcher cropping. Build with
`pnpm build`; deploy the entire `.output` together so the worker, Workbox runtime,
manifest, icons, and server belong to the same release. Serve `sw.js` and
`manifest.webmanifest` with revalidation, as configured by the module's route rules.
Do not widen precache globs or add runtime caches for API/page/media responses.

Run `pnpm build` followed by `pnpm test:pwa` for the production Chromium suite
(install Chromium with `pnpm test:e2e:install` first if needed). It uses an isolated
seeded database and artifact directory, verifies installation metadata and cache
contents, exercises real range streaming and playback, and simulates an update
with a player and a draft in separate tabs. The generated worker in `.output` is
temporarily changed and restored; do not run this check against a deployed build
or concurrently with another build. Happy DOM tests disable registration because
they do not implement service workers; component feedback is still covered there.
