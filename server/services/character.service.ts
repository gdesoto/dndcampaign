import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import type { CharacterSection } from '#shared/schemas/character'
import { CharacterSyncService } from './character-sync.service'

type CharacterSectionKey =
  | 'basics'
  | 'abilityScores'
  | 'saves'
  | 'skills'
  | 'classes'
  | 'race'
  | 'background'
  | 'equipment'
  | 'currency'
  | 'spells'
  | 'features'
  | 'proficiencies'
  | 'languages'
  | 'traits'
  | 'inventory'
  | 'resources'
  | 'hitPoints'
  | 'defenses'
  | 'conditions'
  | 'attacks'
  | 'notes'
  | 'appearance'
  | 'portrait'
  | 'allies'
  | 'organizations'
  | 'companions'
  | 'custom'

const sectionKeyMap: Record<CharacterSection, CharacterSectionKey> = {
  BASICS: 'basics',
  ABILITY_SCORES: 'abilityScores',
  SAVES: 'saves',
  SKILLS: 'skills',
  CLASSES: 'classes',
  RACE: 'race',
  BACKGROUND: 'background',
  EQUIPMENT: 'equipment',
  CURRENCY: 'currency',
  SPELLS: 'spells',
  FEATURES: 'features',
  PROFICIENCIES: 'proficiencies',
  LANGUAGES: 'languages',
  TRAITS: 'traits',
  INVENTORY: 'inventory',
  RESOURCES: 'resources',
  HIT_POINTS: 'hitPoints',
  DEFENSES: 'defenses',
  CONDITIONS: 'conditions',
  ATTACKS: 'attacks',
  NOTES: 'notes',
  APPEARANCE: 'appearance',
  PORTRAIT: 'portrait',
  ALLIES: 'allies',
  ORGANIZATIONS: 'organizations',
  COMPANIONS: 'companions',
  CUSTOM: 'custom',
}

const getSectionKey = (section: CharacterSection) => sectionKeyMap[section]

export const setSheetSection = (
  sheetJson: Record<string, unknown>,
  section: CharacterSection,
  payload: unknown
) => {
  const key = getSectionKey(section)
  if (key === 'currency') {
    const inventory = (sheetJson.inventory as Record<string, unknown> | undefined) || {}
    inventory.currency = payload
    sheetJson.inventory = inventory
    return sheetJson
  }
  if (key === 'languages') {
    const proficiencies = (sheetJson.proficiencies as Record<string, unknown> | undefined) || {}
    proficiencies.languages = payload
    sheetJson.proficiencies = proficiencies
    return sheetJson
  }
  if (key === 'traits') {
    const race = (sheetJson.race as Record<string, unknown> | undefined) || {}
    race.traits = payload
    sheetJson.race = race
    return sheetJson
  }
  sheetJson[key] = payload
  return sheetJson
}

export const computeCharacterSummary = (
  name: string,
  sheetJson: Record<string, unknown>,
  portraitUrl?: string | null
) => {
  const basics = (sheetJson.basics as Record<string, unknown> | undefined) || {}
  const classes = (sheetJson.classes as Array<Record<string, unknown>> | undefined) || []
  const race = (sheetJson.race as Record<string, unknown> | undefined) || {}
  const background = (sheetJson.background as Record<string, unknown> | undefined) || {}
  const defenses = (sheetJson.defenses as Record<string, unknown> | undefined) || {}
  const hitPoints = (sheetJson.hitPoints as Record<string, unknown> | undefined) || {}
  const abilityScores = (sheetJson.abilityScores as Record<string, unknown> | undefined) || {}

  const levelFromBasics = typeof basics.level === 'number' ? basics.level : undefined
  const levelFromClasses = classes
    .map((entry) => (typeof entry.level === 'number' ? entry.level : 0))
    .reduce((total, value) => total + value, 0)
  const level = levelFromBasics ?? (levelFromClasses || undefined)
  const classNames = classes
    .map((entry) => (typeof entry.name === 'string' ? entry.name : undefined))
    .filter((entry): entry is string => Boolean(entry))

  const getAbilityTotal = (val: unknown): number | undefined => {
    if (typeof val === 'number') return val
    if (typeof val === 'object' && val !== null) {
      const v = val as Record<string, unknown>
      if (typeof v.total === 'number') return v.total
      if (typeof v.base === 'number') return v.base
    }
    return undefined
  }
  const wis = getAbilityTotal(abilityScores.wis)
  const passivePerception =
    typeof abilityScores.passivePerception === 'number'
      ? abilityScores.passivePerception
      : wis !== undefined
        ? 10 + Math.floor((wis - 10) / 2)
        : undefined

  return {
    name,
    level,
    classes: classNames.length ? classNames : undefined,
    race: typeof race.name === 'string' ? race.name : undefined,
    background: typeof background.name === 'string' ? background.name : undefined,
    alignment: typeof basics.alignment === 'string' ? basics.alignment : undefined,
    hp: typeof hitPoints.current === 'number' ? hitPoints.current : undefined,
    ac: typeof defenses.ac === 'number' ? defenses.ac : undefined,
    passivePerception,
    portraitUrl: portraitUrl || (typeof sheetJson.portrait === 'string' ? sheetJson.portrait : undefined),
  }
}

export class CharacterService {
  private syncService = new CharacterSyncService()

  async createManualCharacter(ownerId: string, name: string, sheetJson?: Record<string, unknown>) {
    const sheet = sheetJson || { basics: { name } }
    const summary = computeCharacterSummary(name, sheet)
    return db.insert(tables.playerCharacter).values({
      ownerId,
      name,
      sheetJson: sheet as JsonValue,
      summaryJson: summary as JsonValue,
      sourceProvider: 'MANUAL',
    }).returning().get()
  }

  async updateCharacterSection(characterId: string, ownerId: string, section: CharacterSection, payload: unknown) {
    const character = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.id, characterId),
        eq(tables.playerCharacter.ownerId, ownerId),
      ),
    })
    if (!character) return null

    const sheetJson = (character.sheetJson as Record<string, unknown>) || {}
    const updatedSheet = setSheetSection({ ...sheetJson }, section, payload)
    const summary = computeCharacterSummary(character.name, updatedSheet, character.portraitUrl)

    const updated = await db.update(tables.playerCharacter).set({
      sheetJson: updatedSheet as JsonValue,
      summaryJson: summary as JsonValue,
    }).where(eq(tables.playerCharacter.id, character.id)).returning().get()!
    await this.syncService.syncGlossaryForCharacter(updated.id, ownerId)
    return updated
  }

  async updateCharacterMeta(
    characterId: string,
    ownerId: string,
    data: { name?: string; status?: string | null; portraitUrl?: string | null }
  ) {
    const character = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.id, characterId),
        eq(tables.playerCharacter.ownerId, ownerId),
      ),
    })
    if (!character) return null

    const name = data.name ?? character.name
    const sheetJson = (character.sheetJson as Record<string, unknown>) || {}
    const summary = computeCharacterSummary(name, sheetJson, data.portraitUrl ?? character.portraitUrl)

    const updated = await db.update(tables.playerCharacter).set({
      name,
      status: data.status ?? character.status,
      portraitUrl: data.portraitUrl ?? character.portraitUrl,
      summaryJson: summary as JsonValue,
    }).where(eq(tables.playerCharacter.id, character.id)).returning().get()!
    await this.syncService.syncGlossaryForCharacter(updated.id, ownerId)
    return updated
  }
}

