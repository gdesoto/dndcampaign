# Encounter maps

The campaign's **Encounter maps** workspace creates editable tactical maps from a
seed and generation settings. It supports dungeons, buildings with one to four
floors, and forest encounters. The workspace uses
`/campaigns/:campaignId/encounter-maps` and
`/campaigns/:campaignId/encounter-maps/:encounterMapId`. Existing dungeon records
remain available; the former `dungeons` routes have been removed.

Internal feature code uses `EncounterMap` names: components live in
`app/components/encounter-map/`, services in `server/services/encounter-map/`,
and the shared schemas, types, and utilities use `encounter-map` filenames.
`useEncounterMaps` owns the list, editor, and export API calls. Dungeon names
remain at compatibility boundaries: database tables and columns, portable JSON
`dungeon`/`dungeonId` fields, and historical activity identifiers. `DUNGEON` is
also the dungeon map type.

## Generation and editing

Choose a map type, content theme, size, encounter scale, flow, and seed when creating a map.
Access, tactical terrain, and vertical-connection controls shape the resulting
layout. Buildings also expose a floor count. A seed with the same settings and
generator version reproduces geometry and generated content; timestamps and
pass history record each generation run.

Creating and editing a map use the same settings form (`EncounterMapGeneratorOptions`).
Densities and chances are percentage sliders, room size is a min–max range, and
the canvas size offers presets or custom dimensions. Changing the map type
replaces the content theme only while it is still the previous type's default.

The map page shows the map beside a tabbed panel: **Generator**, **Room**,
**Contents**, **Links**, and **History**. Generator settings are a draft until
saved or applied. The panel marks unsaved settings and offers Save and Discard.
**Generate** rebuilds the map from the draft settings and seed. **Reroll** does
the same with a new random seed. The Generate menu regenerates doors, traps,
encounters, or treasure alone. Each regeneration offers **Undo**, which restores
the snapshot taken just before it. A layout rebuild asks for confirmation only
when saved room details or room links would be reset.

The map canvas uses MapLibre, like the campaign world map. It provides pan,
pinch and wheel zoom, keyboard navigation, and fullscreen. The renderer's SVG is
rasterized at about the on-screen resolution. Rooms and room contents are
GeoJSON overlays: clicking a room opens it in the Room tab, and clicking a trap,
encounter, treasure, or door marker opens it in Contents. Selecting an item in a
list highlights it on the map and brings it into view. The Layers menu toggles
labels, grid, the encounter route, and player view.

The Legend popover lists only what appears on the current floor and view.
`renderEncounterMapLegend` draws its swatches with the same symbol code as the map,
so the two cannot drift apart. The canvas omits the in-image "Blocks sight" key
(`includeKey: false`); SVG, PNG, and PDF exports keep it, because they have no
separate legend.

In Contents, a trap, encounter, or treasure can be pinned. Regenerating that
content layer keeps pinned items (`isLocked`). Doors have lock and secret
toggles instead. Links use a searchable picker of the campaign's quests,
sessions, milestones, glossary entries, and encounters, and list linked records
by name.

| Type | Structure |
| --- | --- |
| Dungeon | A planned route links entry, a guard post, an objective, and an escape chamber. Chambers are placed around that route with optional side branches or an alternate approach. |
| Building | Halls connect adjoining rooms within a shared footprint. Dedicated stairwells hold aligned stair flights and landings between adjacent floors. |
| Forest | Clearings connected by trails, surrounded by trees, rocks, and brush. Terrain placement reserves clearings and travel routes. Forest maps have no generated doors. |

Generated maps include an entrance and exit with visible routes to the edge of
the map. The GM's encounter flow identifies three distinct visible rooms for
entry, objective, and exit, and an ordered walk through them. Each step uses an
actual corridor or stair connection. Routes may revisit rooms, including when an
upper-floor objective requires returning downstairs to reach the exit.

The flow choices are **Direct route**, **Branching exploration** (the default),
and **Alternate routes** (`LINEAR`, `BRANCHING`, and `LOOP` in the API).
Dungeons and forests use a single route, optional side branches, or an alternate
approach around the initial challenge respectively.
Buildings retain practical access to their functional rooms; Alternate routes adds a
separate service gallery that keeps circulation outside private rooms.
Changing the flow setting applies when generating a new layout. Existing maps
retain their saved geometry and route until regeneration or an edit changes it.

The encounter scale controls the scope independently of canvas size:
**Single encounter** (`SINGLE`) concentrates combat at one objective,
**Encounter sequence** (`SEQUENCE`, the default) connects several encounter
spaces, and **Exploration site** (`COMPLEX`) creates a larger site with more
rooms. A single encounter still includes distinct approach, objective, and exit
spaces so that access and retreat remain part of the map.

Access controls allow one to three visible entrances and one to two exits. The
main entrance can face north, east, south, or west, or use automatic placement;
additional entrances may use other edges. Enabling a concealed entrance adds
one extra secret approach beyond the visible entrance count. Exterior routes
avoid other rooms and existing passages.

Tactical terrain can include light or heavy cover, raised platforms or ledges,
difficult terrain, and hazards. Open, mixed, and broken sightlines change which
features obstruct sight. Cover controls apply to generated tactical props;
forests retain their natural vegetation and rocks. Doorways, stair landings,
and internal travel routes are reserved before props are placed.

Multi-floor buildings support one or two staircases between adjacent floors,
optional ladders, and balconies above ground. A basement occupies the first of
the configured floors: two total floors with a basement means basement and
ground floor. Balconies therefore require at least three total floors when a
basement is enabled. Bridges can be generated in all map types. Floor labels
distinguish the basement, ground floor, and upper floors.

With a generated flow and nonzero encounter density, the objective receives a
hard final confrontation. Single encounter scale generates only that fight;
other scales add a medium challenge in the first eligible approach space and
use the configured densities for other rooms. Buildings use a hall checkpoint
to guard the approach to the stairs or private rooms. Nonzero treasure density
places the main reward at the objective. Entry and exit
rooms and stairwells receive no generated traps, encounters, or treasure; halls
only receive the deliberate checkpoint encounter. Setting a content density to
zero disables new content in that layer. Scoped regeneration retains locked room
content when Preserve locks is enabled, including multiple locked items in one
room. Main-route doors are never generated as
secret doors.

Floor selection changes the displayed map and available room choices. New rooms,
walls, and painted zones belong to the selected floor. Corridors connect rooms
on the same floor; stairs provide the connections between floors. A room that
contains a stair or ladder cannot be deleted or moved/resized so that any part of
the connection leaves its room. Moving or resizing an entrance/exit room
reanchors its exterior route to the same map edge; deleting that room removes
its attached portals. Edits that move an exterior route outside the map are
rejected before saving. Room, corridor, and wall geometry edits clear the generated
encounter flow, so a custom layout does not display an outdated route. Zone edits keep it.
These constraints are enforced by the server as well as the editor.

Terrain attached to a room moves with that room and is removed when the room is
deleted. A resize that would clip attached terrain is rejected. Natural terrain
without a room owner remains fixed on its floor.

Room records hold names, descriptions, notes, read-aloud text, tags, and explored
state. New generated room records use their map purpose labels. Existing room
records and links survive ordinary map edits. A room can be linked to an
encounter, and the workspace also links maps to sessions, quests, milestones,
glossary entries, and encounters.

## Persistence and regeneration

Map geometry and generator settings are stored in the existing dungeon JSON
columns. `mapType` distinguishes `DUNGEON`, `BUILDING`, and `FOREST`.
`floorCount` is one for dungeons and forests and one to four for buildings.
Rooms, wall segments, terrain, and zones carry a zero-based `floor` when needed.
Corridors infer their floor from their endpoint rooms, and doors belong to a
corridor; a corridor may be marked as a `BRIDGE`. Rooms optionally distinguish
`ROOM`, `HALL`, `STAIRWELL`, `CLEARING`, and `BALCONY` kinds. Each vertical
connection is a `STAIRS` or `LADDER` record referencing rooms on adjacent floors;
its `x`/`y` locate the
top-left of a shared `width` by `height` footprint that fits inside both rooms.
Older connections without a kind represent stairs; missing dimensions use a
one-cell footprint. Optional `floorLabels` must contain one label per floor.

Terrain kinds include natural `TREE`, `ROCK`, and `BRUSH`, and tactical `COVER`,
`ELEVATION`, `DIFFICULT`, and `HAZARD`. Features can include a label, elevation in
feet, and movement/sight blocking flags. A `roomId` refers to geometry and
requires the feature to remain inside that room on the same floor.

`portals` store entrance/exit routes from a wall cell inside the attached room to
the map boundary, with optional labels and `isSecret` flags. `flow` stores the
style and entry, objective, exit, and ordered
room references. Imports reject invalid portal geometry, missing flow references,
and flow steps without a corridor or stair connection.

The portable map schema remains version 1. Older maps may omit these additive
map-type and floor fields and are treated as single-floor dungeons. Maps without
portals, room kinds, stair dimensions, floor labels, or flow metadata remain supported;
existing stored layouts are preserved until explicitly regenerated. Snapshot
labels are the only related database column (`CampaignDungeonSnapshot.label`).

Regenerating a content layer preserves geometry, floors, stairs, terrain,
portals, and encounter flow. Full and layout regeneration rebuild the map and
its room records using submitted generation settings, or the saved settings
when none are submitted, and save those settings with the result.
Content-only regeneration uses the saved settings;
its API request rejects a `config` payload to avoid saving layout options that
were not applied. Regeneration saves a `PRE_REGENERATE` snapshot first and
returns its id as `previousSnapshotId`, which the editor uses for Undo. Only the
20 newest `PRE_REGENERATE` snapshots are kept per map. Manual snapshots can carry
a label, and any snapshot can be renamed. History shows each snapshot's
label or type, time, seed, map type, room count, and a preview. Previews come
from the list's `include=map` option, which gives viewers player-safe maps.

Snapshots preserve map geometry and generator settings. Generating a replacement
layout and full or layout regeneration recreate room records from geometry.
Restoring a snapshot does the same unless every room keeps its id, number,
position, size, and floor, as when undoing a content-only regeneration. Recreated
records reset saved room names, descriptions, notes, read-aloud text, tags, and
explored state. Room links remain but become whole-map links when their original
room records are removed. Content-only regeneration keeps room records and links.
A snapshot is not a backup of separately edited room metadata or room-link
associations.

## Export, import, and access

SVG, PNG, and PDF exports render the selected floor, including its terrain,
entrance/exit routes, and stairs. JSON exports include all floors and preserve
room purposes and kinds, terrain, stair footprints, portals, encounter flow, and
floor-specific edits for import. Visual exports use the same map renderer as
the editor.

Player-safe views remove secret rooms and doors and omit corridors or stairs
whose endpoint rooms are hidden. Secret portals and portals attached to hidden
rooms are omitted, as are terrain features owned by hidden rooms.
Player-safe views and exports omit GM encounter-flow metadata; player-safe JSON
exports also omit GM notes, hidden room records, and links to hidden rooms.
The concealed-entrance setting is redacted to false in viewer details and
player-safe exports. Viewers are forced to receive player-safe exports, and
their room lists exclude hidden rooms.
Campaign content permissions control reading and editing; publishing requires
campaign public-management permission.

The canonical resource is `/api/campaigns/:campaignId/encounter-maps`, with
individual maps addressed by `:encounterMapId`. Rooms, links, and snapshots
remain nested under that map resource. The former `dungeons` API paths have
been removed; request and response payloads retain their existing fields.
Creation accepts `config.mapType`, `config.floorCount`, and
`config.encounterFlow`, plus `config.encounterScale`, `config.accessPoints`,
`config.tacticalTerrain`, and `config.verticalConnections`. The resource PATCH accepts the existing typed
`generate`, `regenerate`, and `export` actions;
`export.floor` selects a zero-based floor for visual formats. The `/map` PATCH
accepts ordered editing actions; `ADD_ROOM`, `DRAW_WALL_SEGMENT`, and `PAINT_ZONE`
accept an optional `floor`. The full contract is in
[OpenAPI](../public/openapi.json).
