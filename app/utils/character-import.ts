export type CharacterImportMode = 'FULL' | 'SECTIONS'

export type CharacterImportSection =
  | 'BASICS'
  | 'ABILITY_SCORES'
  | 'SAVES'
  | 'SKILLS'
  | 'CLASSES'
  | 'RACE'
  | 'BACKGROUND'
  | 'EQUIPMENT'
  | 'CURRENCY'
  | 'SPELLS'
  | 'FEATURES'
  | 'PROFICIENCIES'
  | 'LANGUAGES'
  | 'TRAITS'
  | 'INVENTORY'
  | 'RESOURCES'
  | 'HIT_POINTS'
  | 'DEFENSES'
  | 'CONDITIONS'
  | 'ATTACKS'
  | 'NOTES'
  | 'APPEARANCE'
  | 'PORTRAIT'
  | 'ALLIES'
  | 'ORGANIZATIONS'
  | 'COMPANIONS'
  | 'CUSTOM'

export type CharacterImportPayload = {
  provider: 'DND_BEYOND'
  externalId: string
  overwriteMode: CharacterImportMode
  sections: CharacterImportSection[]
}

export type CharacterImportRefreshPayload = {
  overwriteMode: CharacterImportMode
  sections: CharacterImportSection[]
}

export const characterImport403ErrorMessage =
  'DnD Beyond returned a 403 error. Are you sure the Character Privacy is set to Public?'

export const characterImportSectionItems: Array<{
  label: string
  value: CharacterImportSection
}> = [
  { label: 'Basics', value: 'BASICS' },
  { label: 'Ability Scores', value: 'ABILITY_SCORES' },
  { label: 'Saves', value: 'SAVES' },
  { label: 'Skills', value: 'SKILLS' },
  { label: 'Classes', value: 'CLASSES' },
  { label: 'Race', value: 'RACE' },
  { label: 'Background', value: 'BACKGROUND' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Currency', value: 'CURRENCY' },
  { label: 'Spells', value: 'SPELLS' },
  { label: 'Features', value: 'FEATURES' },
  { label: 'Proficiencies', value: 'PROFICIENCIES' },
  { label: 'Languages', value: 'LANGUAGES' },
  { label: 'Traits', value: 'TRAITS' },
  { label: 'Inventory', value: 'INVENTORY' },
  { label: 'Resources', value: 'RESOURCES' },
  { label: 'Hit Points', value: 'HIT_POINTS' },
  { label: 'Defenses', value: 'DEFENSES' },
  { label: 'Conditions', value: 'CONDITIONS' },
  { label: 'Attacks', value: 'ATTACKS' },
  { label: 'Notes', value: 'NOTES' },
  { label: 'Appearance', value: 'APPEARANCE' },
  { label: 'Portrait', value: 'PORTRAIT' },
  { label: 'Allies', value: 'ALLIES' },
  { label: 'Organizations', value: 'ORGANIZATIONS' },
  { label: 'Companions', value: 'COMPANIONS' },
  { label: 'Custom', value: 'CUSTOM' },
]

export const getCharacterImportErrorMessage = (error: unknown, fallback: string) => {
  const typedError = error as Error & {
    message?: string
    code?: string
    status?: number
    statusCode?: number
    response?: { status?: number }
    data?: { error?: { message?: string } }
  }
  const statusCode = typedError.statusCode || typedError.status || typedError.response?.status
  const baseMessage = typedError.message || typedError.data?.error?.message || fallback
  return statusCode === 403 || typedError.code === 'IMPORT_FORBIDDEN'
    ? characterImport403ErrorMessage
    : baseMessage
}
