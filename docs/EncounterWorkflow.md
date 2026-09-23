# Encounter workspace and MCP workflow

The participant list and details stay in place across phases. Selecting a participant is local inspection; it never changes whose turn it is. Initiative order changes preserve the active participant. Removing that participant selects the next surviving turn position.

| Phase | Allowed operations |
| --- | --- |
| Planned | Edit settings/participants, prepare initiative and conditions, add notes, Start (requires participants), Abandon |
| Active | Preparation/corrections, damage/healing, turn progression, Pause, Complete, Abandon, reset turn progress |
| Paused | Preparation/corrections and damage/healing; Resume requires participants. No turn movement or automatic ticking. |
| Completed / Abandoned | Inspect record/history; explicit Reopen enters Paused without resetting progress. |

Start initializes round 1/first participant. Reopen never starts combat. Reset returns to Planned and resets round/turn only; it preserves HP, conditions and history. Advancing ticks outgoing TURN_END conditions, ROUND_END on wrap, then incoming TURN_START conditions. Rewind moves the pointer without undoing HP or condition history. Setting the active turn does not tick conditions. Expired conditions remain visible at zero for review/removal.

## Agent tool path

1. `encounters_list` or `encounter_create` finds/creates the encounter.
2. `encounter_get` returns `status`, `activeParticipantId`, `combatants` (participants), conditions, history, and `availableActions`. Each action has `allowed` and, when unavailable, `reason`. These also reflect campaign editing permissions.
3. `encounter_participant_add` takes `{encounterId, body: {participants: [...]}}`, 1-50 entries atomically. PCs use `CAMPAIGN_CHARACTER`/`sourceCampaignCharacterId` or `PLAYER_CHARACTER`/`sourcePlayerCharacterId`; NPCs use `GLOSSARY_ENTRY`/`sourceGlossaryEntryId`; stat blocks use `CUSTOM`/`sourceStatBlockId`. Names and side are explicit; source stats fill omitted HP/AC/speed. Explicit zero is preserved. Repeat a source with distinct names for multiple creatures.
4. `encounter_participant_update` takes participantId and `{action: 'edit', changes: {...}}` or `{action: 'remove'}`. Changes include side, initiative, stats, notes and flags. Removal also removes conditions.
5. `encounter_transition` takes `{body: {action: 'start'|'pause'|'resume'|'complete'|'abandon'|'reopen'|'reset'}}`.
6. `encounter_turn` supports `roll` (ALL/UNSET/NON_PCS), `clear` (all participants, or one with combatantId), `reorder` (combatantOrder), `set-initiative` (participantId, initiative), `advance`, `rewind`, and `set-active` (combatantId). The last three require Active.
7. `encounter_participant_effect` takes `damage`/`heal` with participantIds and amount, `condition-add` with participantIds and condition, or `condition-update`/`condition-remove` with participantId and conditionId. Multi-target operations are atomic; every target must belong to the encounter. Missing current HP rejects damage/healing rather than assuming zero.
8. `encounter_event_note_create` records narrative notes; `encounter_summary_get` reads results.

New workflow tools return updated encounter state. participant_update and set-initiative also require encounters.read to retrieve it. All require encounters.write for mutation. The older combatant/condition tools remain for compatibility and enforce the same phases. Tools never start, resume, or reopen implicitly.

## API compatibility

Existing URLs remain. POST `/api/encounters/:id/combatants` accepts legacy single input (returns one participant) or `{participants:[...]}` (returns encounter state). PATCH on that collection applies typed effects and returns encounter state. Encounter PATCH accepts typed lifecycle actions or metadata; raw status/currentRound/currentTurnIndex writes are rejected so callers cannot bypass phases. Encounter/turn/initiative PATCH now return full encounter state (including existing summary fields). Invalid phases return 409 `ENCOUNTER_ACTION_UNAVAILABLE` with a next-step explanation. Unknown HP returns 409 `HP_REQUIRED`.

No database migration is required. Changes apply to newly loaded pages and API/MCP requests; existing participant stats are not backfilled.

Initiative controls live in the Participants header. Roll and clear support the whole roster or a single participant (`combatantId` through the initiative API or MCP `encounter_turn`). Clearing preserves order and the active turn; the UI offers Undo. Participant rows expose move up/down and individual roll/clear controls during Planned, Active, and Paused phases.
