# Recordings and recap playback

DM Vault uses Video.js 10 (`@videojs/html`, pinned to 10.5.0) with the packaged
Neutral audio and video skins. The same global player serves private recording
details, transcript seeking, session recording/recap actions, campaign recaps and
public recap pages. Its controls use DM Vault's gold accent and typography.

## Player lifetime and controls

The app root owns one player. Page docks, the persistent compact player and its
expanded drawer present that player rather than creating competing media players.
Navigation preserves the current source and position. Explicitly selecting another
recording or recap replaces it; Close stops playback and clears the active queue.

Video.js owns the timeline, volume, speed, caption selection, loading indicators,
error dialog, keyboard/touch interactions, fullscreen and picture-in-picture.
The compact player offers playback, expansion and Close. Retry is app-owned:
terminal failures reload the selected stream and retain the current position.
Drag the drawer by its native grab handle, or use Minimize to return to the compact
player. Its body leaves pointer gestures to the player controls.
Volume, mute and speed choices survive source/kind changes during the open app session;
they are not saved across browser visits. Availability of volume, fullscreen,
picture-in-picture and remote-playback controls depends on the browser/device.
Files retain their uploaded formats; the browser must support their codecs.

Video uses inline playback until fullscreen is requested. On iPhone Safari,
Video.js uses native video fullscreen and system controls; other supported
browsers can present the whole player. Captions use the recording's existing
authenticated WebVTT track, including native video fullscreen where supported.
Transcript segment seeking and bounded segment playback continue to use the same
player. The library's audio seek buttons and keyboard steps use its 10-second
defaults, replacing the prior custom 5/30-second buttons.

## Recap watch queues and resume

The private `/campaigns/:campaignId/watch` and public `/public/:publicSlug/watch`
pages order recaps chronologically. `?recap=:recapId` selects a specific recap
without autoplay. Without that query, the active queue's item wins, followed by
the browser's most recently played recap, then the oldest available recap.
An unavailable explicit ID shows an error and does not silently select another.

Playback positions are stored per recap in this browser. New selections resume
their saved position; advancing automatically starts the next recap at zero.
Completed or out-of-range positions restart at zero. Storage failures do not
block playback. The existing `dmvault-recap-progress-v1:` keys remain compatible.

The active watch queue survives leaving the page. Previous/Next and **Play next
automatically** remain available in the compact player; system track controls use
the same queue. Turning automatic advancement off keeps manual Next available.
The queue stops at its end, and selecting unrelated media clears it. While the
watch page is open, automatic selection also updates its share URL. Queue contents
are an in-memory snapshot; reload the watch page to pick up changed availability.
Every actual stream request still checks server authorization.

Campaign/session recap list actions play the selected item; opening its watch
link establishes the chronological watch queue. Private streams use artifact
identity; public streams retain their public-access lookup and dedicated route.
No private artifact identities are exposed by public recap lists. Existing HTTP
range streaming, permissions, uploads and storage are unchanged.

## Mobile and PWA

Where Media Session is available, the app supplies title, session subtitle,
DM Vault artwork, playback position and play/pause/stop/seek/track actions for
lock-screen and headset controls. Unsupported actions are omitted. The active
queue remains available while the app is open, including background transitions
where the browser/OS allows them.

A library and an installed PWA do not override autoplay policy, background
execution limits, video restrictions, battery management or interruptions.
Screen-lock listening and background next-episode playback require physical
iOS/Android tests in browser and installed modes. No transcoding, audio derivatives
or offline media downloads are implemented.

The PWA's private-data cache boundaries and passive-update safeguards remain in
place; see [PWA installation and validation](PWA.md). Research and validation
evidence live in the [migration record](planning/VideoJsMigration.md).
