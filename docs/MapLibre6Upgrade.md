# MapLibre GL JS 6 upgrade

Reviewed and upgraded on 2026-09-10: 5.24.0 → 6.9.0 (`^6.9.0`).

## Scope and compatibility

The integration is `app/components/maps/Viewer.vue`, shared by authenticated campaign maps and public maps. It renders Azgaar GeoJSON over an optional SVG background. The dungeon editor's `MapCanvas.vue` does not use MapLibre. No API, import format, or database migration is required.

| Upstream change | Project impact and handling |
| --- | --- |
| ESM-only distribution; default export and UMD/CSP bundles removed | Existing client-only dynamic import remains appropriate. |
| Bundlers must provide the worker URL | Added Vite's `?worker&url` import and `setWorkerUrl`. Plain `?url` would omit the worker's shared-module dependency in production. |
| WebGL2 and ES2022 required | Older WebGL1-only devices are no longer supported. Constructor failure now displays a useful WebGL2 message. |
| Stronger event/property types; event classes and Camera composition | Replaced the handwritten `MapLike` interface and casts with package types. Fixed an unsupported map-level `mouseleave` subscription using the DOM canvas container. No private transform or Camera-inheritance usage exists. |
| GeoJSON `setData` signature/return changes | Existing one-argument calls do not use its return value; compatible. |
| Legacy style expressions rejected | Current filters use modern expressions; typed and exercised in the browser. |
| Overscale default becomes 4; feature queries can change | Kept the new default. Checked point and polygon selection plus settlement zoom thresholds. Hit testing still prioritizes non-state features. |
| Nested GeoJSON properties round-trip differently | Viewer reads scalar identifiers, names, types, populations and flags; no dependency on stringified nested objects. |
| Missing-image resolver, hash parsing, light interpolation and shader pragma changes | Not used by this integration. No migration needed. |

Sources: [v6 release notes](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0), [migration guide](https://github.com/maplibre/maplibre-gl-js/blob/v6.0.0/docs/guides/v5-to-v6-migration-guide.md), [Vite worker setup](https://github.com/maplibre/maplibre-gl-js/blob/v6.0.0/docs/index.md#installation).

## Simplifications implemented

- **One GeoJSON source.** The three selection overlays use native filters over the original source. Selecting a feature no longer constructs, serializes and sends a second feature collection to the worker. Selected overlays retain their original styling and remain independent of base-layer visibility.
- **Direct canvas image updates.** MapLibre 6.1 introduced `ImageSource.updateImage({ image })`, and 6.7 allows an initially empty image source. The viewer fetches and decodes an SVG once per background load, keeps one canvas, and redraws it at the same 1×/2×/3×/4× zoom thresholds. This removes PNG/base64 encoding, subsequent PNG decoding, and the four-entry encoded-image cache. See [ImageSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/).
- **Native viewport constraints.** `setMaxBounds` already calculates the covering zoom. Removed the duplicate projection/span/logarithm calculation and the fixed minimum zoom that could become stale after resize or a bounds change.
- **Shared filtering and hit testing.** Consolidated repeated glossary filter updates and the identical hover/click query logic. Removed a redundant population-threshold watcher.
- **Independent background loading.** Vector features initialize immediately. Failed SVG loads leave the interactive vector map usable. Requests are aborted on replacement/unmount, and late decodes cannot update a different map or a removed viewer.
- **Preserved UI behavior.** Selection emits, hover labels, glossary-only filtering, layer toggles, navigation controls, colors, opacity, and settlement thresholds remain intact.

The package also includes image-source texture lifecycle fixes in 6.3/6.4 and container-resize fixes in 6.9; these are relevant to this viewer without additional application work. See the [versioned changelog](https://github.com/maplibre/maplibre-gl-js/blob/v6.9.0/CHANGELOG.md). No frame-rate or memory benchmark was performed; performance benefits above describe removed work rather than measured speedups.

## Custom code retained deliberately

- SVG decoding/rasterization is still needed to preserve the uploaded cartographic artwork and zoom-dependent detail. A continuously animated canvas source would add unnecessary rendering work.
- Population buckets, glossary matching, and feature-priority rules are campaign behavior, not generic MapLibre functionality.
- The cursor-following tooltip remains custom. A geographic Popup would change placement and interaction behavior without a demonstrated benefit.
- Native feature-state could optimize frequent selection changes further, but requires additional state synchronization and paint expressions. Selection filters are simpler here. Likewise, differential `updateData` adds little while the API supplies full snapshots.
- Native symbol labels, clustering, vector tiles and terrain are potential future features, not equivalent replacements for the imported SVG. They would need separate product requirements and performance evidence.

## Validation

- 200 unit/Nuxt tests passed; six new tests cover shared-source selection, data refresh, glossary filtering, zoom thresholds, feature priority, hover cleanup, async replacement/unmount, direct image updates, bounds changes and WebGL2 failure.
- Lint and TypeScript checks passed.
- Docker production build passed and contains a bundled MapLibre worker asset.
- A standalone Vite production fixture using the actual viewer passed Chromium checks for rendered/selectable features, hover leave, filtering, zoom, resize and remount. Development browser checks verified native minimum covering zoom, major/minor settlement thresholds and the 4× SVG tier.
- The actual **Love's Aeterna Ira / Chronosia** campaign was checked in the authenticated local app: SVG artwork/labels, Evercrest hover and selection, combined Evercrest/Lurandor selection, staging count, glossary toggle, state/river overlays and zoom. No map errors or warnings were reported. These interactions did not save campaign or glossary changes.

Browser coverage is Chromium only. WebGL1-only environments require a separate fallback product decision; the upgrade provides an explanatory error instead of supporting them.
