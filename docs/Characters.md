# Character sheets and imports

Player characters support manual editing, D&D Beyond imports, campaign
membership, and section refreshes. `PlayerCharacter.sheetJson` holds the
canonical character sheet. `summaryJson` is derived from it when the character
is saved or imported, so list/detail summaries do not form an independent sheet.

## Editing and ability scores

Manual section updates write the selected portion of the sheet and recompute
the summary. Ability scores have two supported representations: a manually
saved number, or an imported object containing `base`, `bonus`, `override`, and
`total`. The display utility uses a numeric value directly; for objects it
prefers `total` and falls back to `base`, accepting only finite numbers.

## Import behavior

The import service maps the provider payload into the application's sheet
sections and retains provider information in the imported sheet. For section
replacement mode, it starts with the existing sheet, filters selected sections
against stored locked sections, and replaces only those resulting sections.
Whole-sheet replacement uses the newly mapped sheet. The service derives the
summary from the resulting sheet before saving it.

Import settings store the default overwrite mode and locked sections; an import
can supply its own overwrite mode and selected sections. Import lookups are
scoped to the character owner.

## Source references

- [Character schema](../shared/schemas/character.ts).
- [Character service](../server/services/character.service.ts) for manual saves
  and summary derivation.
- [Import service](../server/services/character-import.service.ts) for provider
  mapping and overwrite modes.
- [Ability score utility](../app/utils/characterAbilityScore.ts).
