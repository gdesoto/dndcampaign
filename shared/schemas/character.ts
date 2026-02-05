import { z } from 'zod'

export const characterSourceProviderSchema = z.enum(['MANUAL', 'DND_BEYOND'])
export const characterCampaignStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])
export const characterOverwriteModeSchema = z.enum(['FULL', 'SECTIONS'])
export const characterSectionSchema = z.enum([
  'BASICS',
  'ABILITY_SCORES',
  'SAVES',
  'SKILLS',
  'CLASSES',
  'RACE',
  'BACKGROUND',
  'EQUIPMENT',
  'CURRENCY',
  'SPELLS',
  'FEATURES',
  'PROFICIENCIES',
  'LANGUAGES',
  'TRAITS',
  'INVENTORY',
  'RESOURCES',
  'HIT_POINTS',
  'DEFENSES',
  'CONDITIONS',
  'ATTACKS',
  'NOTES',
  'APPEARANCE',
  'PORTRAIT',
  'ALLIES',
  'ORGANIZATIONS',
  'COMPANIONS',
  'CUSTOM',
])

export const characterSheetSchema = z
  .object({
    basics: z
      .object({
        name: z.string().optional(),
        playerName: z.string().optional(),
        level: z.number().optional(),
        alignment: z.string().optional(),
        experience: z.number().optional(),
        inspiration: z.boolean().optional(),
      })
      .optional(),
    race: z
      .object({
        name: z.string().optional(),
        subrace: z.string().optional(),
        traits: z.array(z.string()).optional(),
      })
      .optional(),
    classes: z
      .array(
        z.object({
          name: z.string().optional(),
          subclass: z.string().optional(),
          level: z.number().optional(),
          hitDie: z.string().optional(),
          primaryAbility: z.string().optional(),
        })
      )
      .optional(),
    background: z
      .object({
        name: z.string().optional(),
        feature: z.string().optional(),
        traits: z.array(z.string()).optional(),
        ideals: z.array(z.string()).optional(),
        bonds: z.array(z.string()).optional(),
        flaws: z.array(z.string()).optional(),
      })
      .optional(),
    appearance: z
      .object({
        age: z.number().optional(),
        height: z.string().optional(),
        weight: z.number().optional(),
        eyes: z.string().optional(),
        hair: z.string().optional(),
        skin: z.string().optional(),
        gender: z.string().optional(),
        faith: z.string().optional(),
      })
      .optional(),
    abilityScores: z.record(z.any()).optional(),
    saves: z.array(z.record(z.any())).optional(),
    skills: z.array(z.record(z.any())).optional(),
    hitPoints: z.record(z.any()).optional(),
    defenses: z.record(z.any()).optional(),
    proficiencies: z.record(z.any()).optional(),
    features: z.array(z.record(z.any())).optional(),
    attacks: z.array(z.record(z.any())).optional(),
    spells: z.record(z.any()).optional(),
    equipment: z.array(z.record(z.any())).optional(),
    inventory: z.record(z.any()).optional(),
    resources: z.array(z.record(z.any())).optional(),
    conditions: z.array(z.record(z.any())).optional(),
    notes: z.record(z.any()).optional(),
    portrait: z.record(z.any()).optional(),
    allies: z.array(z.record(z.any())).optional(),
    organizations: z.array(z.record(z.any())).optional(),
    companions: z.array(z.record(z.any())).optional(),
    custom: z.record(z.any()).optional(),
  })
  .passthrough()

export const characterSummarySchema = z
  .object({
    name: z.string(),
    level: z.number().optional(),
    classes: z.array(z.string()).optional(),
    race: z.string().optional(),
    background: z.string().optional(),
    alignment: z.string().optional(),
    hp: z.number().optional(),
    ac: z.number().optional(),
    passivePerception: z.number().optional(),
    portraitUrl: z.string().optional(),
  })
  .passthrough()

export const characterCreateSchema = z.object({
  name: z.string().min(2).max(120),
  sheetJson: characterSheetSchema.optional(),
})

export const characterUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.string().max(120).optional(),
  portraitUrl: z.string().url().optional(),
  section: characterSectionSchema.optional(),
  payload: z.any().optional(),
})

export const characterImportRequestSchema = z.object({
  provider: characterSourceProviderSchema,
  externalId: z.string().min(2),
  overwriteMode: characterOverwriteModeSchema.optional(),
  sections: z.array(characterSectionSchema).optional(),
})

export const characterImportRefreshSchema = z.object({
  overwriteMode: characterOverwriteModeSchema.optional(),
  sections: z.array(characterSectionSchema).optional(),
})

export const campaignCharacterUpdateSchema = z.object({
  status: characterCampaignStatusSchema.optional(),
  roleLabel: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export type CharacterCreateInput = z.infer<typeof characterCreateSchema>
export type CharacterUpdateInput = z.infer<typeof characterUpdateSchema>
export type CharacterImportRequest = z.infer<typeof characterImportRequestSchema>
export type CharacterImportRefresh = z.infer<typeof characterImportRefreshSchema>
export type CampaignCharacterUpdate = z.infer<typeof campaignCharacterUpdateSchema>
export type CharacterSection = z.infer<typeof characterSectionSchema>
