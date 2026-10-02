# Campaign map rendering

Authenticated campaign maps and public maps share
[maps/Viewer.vue](../app/components/maps/Viewer.vue). It renders imported Azgaar
GeoJSON over an optional SVG background using MapLibre GL JS. The dungeon
editor's canvas is a separate renderer.

## Layers and selection

The viewer uses one GeoJSON source for its base layers and selection overlays.
Overlay filters select features from that source. Layer toggles, settlement
population thresholds, glossary matching, and hit-test priority are campaign
behavior implemented by the viewer. Hit testing prioritizes non-state features
when several features overlap; glossary-only filtering uses the feature's
linked-or-matched indicator. Selected overlays remain independent of base-layer
visibility. Hover labels use a cursor-following tooltip.

## Background and viewport

The SVG is fetched and decoded once per background load. A retained canvas
rasterizes it at 1×, 2×, 3×, or 4× according to zoom; the image source receives
direct canvas updates. SVG loads run independently of vector initialization,
so a background failure leaves vector features usable. Replacement and unmount
abort requests, and request identity checks reject late results.

Map coordinates take precedence over fallback bounds. MapLibre's native maximum
bounds constrain the viewport and calculate the minimum covering zoom as its
container changes size.

## Browser runtime

MapLibre is dynamically imported on the client. Its worker is bundled through
Vite's `?worker&url` import and registered with `setWorkerUrl`. The current
MapLibre 6 renderer requires WebGL2 and an ES2022-capable browser; constructor
failure displays a WebGL2 message. There is no WebGL1 fallback renderer.

## Source references

- [Viewer](../app/components/maps/Viewer.vue) and
  [SVG background loader](../app/components/maps/svg-background.ts).
- [Private map service](../server/services/map.service.ts) and
  [public campaign service](../server/services/campaign-public-access.service.ts).
- [Map contracts](../shared/schemas/map/map.ts) and [OpenAPI](../public/openapi.json).
