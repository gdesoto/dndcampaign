import type { JsonValue } from '#server/db/columns'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { ofetch } from 'ofetch'
import { characterSectionSchema, type CharacterSection } from '#shared/schemas/character'
import { computeCharacterSummary, setSheetSection } from './character.service'
import { CharacterSyncService } from './character-sync.service'

type ImportOptions = {
  overwriteMode?: 'FULL' | 'SECTIONS'
  sections?: CharacterSection[]
}

const dndBeyondHeaders = {
  'Content-Type': 'text/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.dndbeyond.com/',
}

const hashJson = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

const normalizeSections = (sections?: CharacterSection[]) =>
  sections && sections.length ? sections : characterSectionSchema.options

const toNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)

const alignmentIdMap: Record<number, string> = {
  1: 'Lawful Good',
  2: 'Neutral Good',
  3: 'Chaotic Good',
  4: 'Lawful Neutral',
  5: 'True Neutral',
  6: 'Chaotic Neutral',
  7: 'Lawful Evil',
  8: 'Neutral Evil',
  9: 'Chaotic Evil',
}

const mapDndBeyondToSheet = (payload: any) => {
  const data = payload?.data || payload
  const stats = Array.isArray(data?.stats) ? data.stats : []
  const bonusStats = Array.isArray(data?.bonusStats) ? data.bonusStats : []
  const overrideStats = Array.isArray(data?.overrideStats) ? data.overrideStats : []

  const abilityScores: Record<string, unknown> = {}
  const idMap: Record<number, string> = {
    1: 'str',
    2: 'dex',
    3: 'con',
    4: 'int',
    5: 'wis',
    6: 'cha',
  }

  stats.forEach((stat: any, index: number) => {
    const base = toNumber(stat?.value)
    const bonus = toNumber(bonusStats[index]?.value)
    const override = toNumber(overrideStats[index]?.value)
    const key = idMap[stat?.id] || stat?.name || stat?.id || `stat_${index}`
    abilityScores[key] = {
      base,
      bonus,
      override,
      total: override ?? (base ?? 0) + (bonus ?? 0),
    }
  })

  return {
    basics: {
      name: data?.name,
      playerName: data?.username,
      level: toNumber(data?.level),
      alignment: alignmentIdMap[data?.alignmentId] ?? data?.alignmentId?.toString() ?? '',
      experience: toNumber(data?.currentXp),
      inspiration: Boolean(data?.inspiration),
    },
    race: {
      name: data?.race?.fullName || data?.race?.baseRaceName,
      traits: data?.race?.racialTraits?.map((trait: any) => trait?.definition?.name).filter(Boolean),
    },
    classes: Array.isArray(data?.classes)
      ? data.classes.map((entry: any) => ({
          name: entry?.definition?.name,
          subclass: entry?.subclassDefinition?.name,
          level: toNumber(entry?.level),
          hitDie: entry?.definition?.hitDice,
          primaryAbility: entry?.definition?.spellCastingAbilityId,
        }))
      : [],
    appearance: {
      age: toNumber(data?.age),
      height: data?.height,
      weight: toNumber(data?.weight),
      eyes: data?.eyes,
      hair: data?.hair,
      skin: data?.skin,
      gender: data?.gender,
      faith: data?.faith,
    },
    hitPoints: {
      max: toNumber(data?.baseHitPoints),
      current: (toNumber(data?.baseHitPoints) ?? 0) - (toNumber(data?.removedHitPoints) || 0),
      temp: toNumber(data?.temporaryHitPoints),
    },
    abilityScores,
    background: {
      name: data?.background?.definition?.name,
      traits: data?.background?.definition?.personalityTraits?.map((item: any) => item.description) || [],
      ideals: data?.background?.definition?.ideals?.map((item: any) => item.description) || [],
      bonds: data?.background?.definition?.bonds?.map((item: any) => item.description) || [],
      flaws: data?.background?.definition?.flaws?.map((item: any) => item.description) || [],
    },
    inventory: {
      currency: data?.currencies,
    },
    portrait: {
      avatarUrl: data?.decorations?.avatarUrl,
    },
    custom: {
      provider: 'DND_BEYOND',
      raw: payload,
    },
  }
}

export class CharacterImportService {
  private syncService = new CharacterSyncService()
  async fetchDndBeyondCharacter(externalId: string) {
    const url = `https://character-service.dndbeyond.com/character/v5/character/${externalId}`
    return ofetch(url, { headers: dndBeyondHeaders })
  }

  async applyImport(
    characterId: string,
    ownerId: string,
    rawJson: unknown,
    options: ImportOptions
  ) {
    const character = await db.query.playerCharacter.findFirst({
      where: and(
        eq(tables.playerCharacter.id, characterId),
        eq(tables.playerCharacter.ownerId, ownerId),
      ),
      with: {
        importSettings: true,
      },
    })
    if (!character) return null

    const sheet = mapDndBeyondToSheet(rawJson)
    const overwriteMode = options.overwriteMode || character.importSettings?.defaultOverwriteMode || 'SECTIONS'
    const locked = Array.isArray(character.importSettings?.lockedSections)
      ? (character.importSettings?.lockedSections as CharacterSection[])
      : []
    const targetSections = normalizeSections(options.sections).filter(
      (section) => !locked.includes(section)
    )

    let nextSheet: Record<string, unknown> = sheet as Record<string, unknown>
    if (overwriteMode === 'SECTIONS') {
      const existing = (character.sheetJson as Record<string, unknown>) || {}
      nextSheet = { ...existing }
      targetSections.forEach((section) => {
        const value = getSectionValue(sheet as Record<string, unknown>, section)
        setSheetSection(nextSheet, section, value)
      })
    }

    const name = character.name || (sheet.basics?.name as string) || 'Untitled'
    const portraitUrl =
      character.portraitUrl ||
      ((sheet.portrait as Record<string, unknown> | undefined)?.avatarUrl as string | undefined)
    const summary = computeCharacterSummary(name, nextSheet, portraitUrl)

    const updated = await db.update(tables.playerCharacter).set({
      name,
      sheetJson: nextSheet as JsonValue,
      summaryJson: summary as JsonValue,
      sourceProvider: 'DND_BEYOND',
      portraitUrl: portraitUrl ?? character.portraitUrl,
    }).where(eq(tables.playerCharacter.id, character.id)).returning().get()!
    await this.syncService.syncGlossaryForCharacter(updated.id, ownerId)
    return updated
  }

  async createFromImport(ownerId: string, externalId: string, options: ImportOptions) {
    const rawJson = await this.fetchDndBeyondCharacter(externalId)
    const sheet = mapDndBeyondToSheet(rawJson)
    const name = (sheet.basics?.name as string) || 'Imported character'
    const portraitUrl = (sheet.portrait as Record<string, unknown> | undefined)?.avatarUrl as
      | string
      | undefined
    const summary = computeCharacterSummary(name, sheet, portraitUrl)

    const character = db.transaction((tx) => {
      const created = tx.insert(tables.playerCharacter).values({
        ownerId,
        name,
        sheetJson: sheet as JsonValue,
        summaryJson: summary as JsonValue,
        portraitUrl,
        sourceProvider: 'DND_BEYOND',
      }).returning().get()
      tx.insert(tables.characterImport).values({
        characterId: created.id,
        provider: 'DND_BEYOND',
        externalId,
        sourceUrl: `https://www.dndbeyond.com/characters/${externalId}`,
        rawJson: rawJson as JsonValue,
        rawHash: hashJson(rawJson),
      }).run()
      return created
    }, { behavior: 'immediate' })

    await this.applyImport(character.id, ownerId, rawJson, options)
    return character
  }

  async importIntoCharacter(
    characterId: string,
    ownerId: string,
    externalId: string,
    options: ImportOptions
  ) {
    const rawJson = await this.fetchDndBeyondCharacter(externalId)
    const updated = await this.applyImport(characterId, ownerId, rawJson, options)
    if (!updated) return null

    await db.insert(tables.characterImport).values({
      characterId: updated.id,
      provider: 'DND_BEYOND',
      externalId,
      sourceUrl: `https://www.dndbeyond.com/characters/${externalId}`,
      rawJson: rawJson as JsonValue,
      rawHash: hashJson(rawJson),
      lastSyncedAt: new Date(),
      lastSyncStatus: 'SUCCESS',
    }).returning().get()

    return updated
  }

  async refreshImport(characterId: string, ownerId: string, options: ImportOptions) {
    const latest = await db.query.characterImport.findFirst({
      where: eq(tables.characterImport.characterId, characterId),
      orderBy: [desc(tables.characterImport.importedAt)],
    })
    if (!latest?.externalId) return null
    return this.importIntoCharacter(characterId, ownerId, latest.externalId, options)
  }
}

const sectionToKey = (section: CharacterSection) => {
  const map: Record<CharacterSection, string> = {
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
  return map[section]
}

const getSectionValue = (sheet: Record<string, unknown>, section: CharacterSection) => {
  switch (section) {
    case 'CURRENCY':
      return (sheet.inventory as Record<string, unknown> | undefined)?.currency
    case 'LANGUAGES':
      return (sheet.proficiencies as Record<string, unknown> | undefined)?.languages
    case 'TRAITS':
      return (sheet.race as Record<string, unknown> | undefined)?.traits
    default:
      return sheet[sectionToKey(section)]
  }
}

