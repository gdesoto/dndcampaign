<script setup lang="ts">
import type { CharacterImportPayload, CharacterImportRefreshPayload } from '~/utils/character-import'
import { getCharacterImportErrorMessage } from '~/utils/character-import'

definePageMeta({ layout: 'default' })

type CampaignOption = { id: string; name: string }
type CampaignLink = {
  id: string
  campaignId: string
  characterId: string
  status: 'ACTIVE' | 'INACTIVE'
  roleLabel?: string | null
  notes?: string | null
  campaign: { id: string; name: string }
  accessImpact?: { warningRequired: boolean; impactedUserCount: number }
}
type Character = {
  id: string
  name: string
  canEdit: boolean
  isOwner: boolean
  status?: string | null
  portraitUrl?: string | null
  sheetJson?: Record<string, unknown>
  summaryJson?: Record<string, unknown>
  campaignLinks: CampaignLink[]
}
type ClassEntry = { name: string; subclass?: string; level?: number; hitDie?: number | string }

const route = useRoute()
const router = useRouter()
const characterId = computed(() => route.params.characterId as string)
const { request } = useApi()

const { data: character, pending, refresh, error } = await useAsyncData(
  () => `character-${characterId.value}`,
  () => request<Character>(`/api/characters/${characterId.value}`)
)
const { data: campaigns } = await useAsyncData('characters-campaigns', () =>
  request<CampaignOption[]>('/api/campaigns')
)

const sheet = computed(() => (character.value?.sheetJson as Record<string, unknown>) || {})
const canEdit = computed(() => Boolean(character.value?.canEdit))

// ── Helpers ──────────────────────────────────────────────────────────────────

const getAbilityTotal = (val: unknown): number => {
  if (typeof val === 'number') return val
  if (typeof val === 'object' && val !== null) {
    const v = val as Record<string, unknown>
    if (typeof v.total === 'number') return v.total
    if (typeof v.base === 'number') return v.base
  }
  return 10
}
const abilityMod = (score: number) => Math.floor((score - 10) / 2)
const fmtMod = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`)

const abilities = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

const abilityScores = computed(() => (sheet.value.abilityScores as Record<string, unknown>) || {})

const hpData = computed(() => {
  const hp = (sheet.value.hitPoints as Record<string, unknown>) || {}
  const max = (hp.max as number) || 0
  const current = (hp.current as number) ?? max
  const temp = (hp.temp as number) || 0
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0
  return { max, current, temp, percent }
})

const hpBarColor = computed(() => {
  const p = hpData.value.percent
  if (p > 50) return 'bg-success-500'
  if (p > 25) return 'bg-warning-500'
  return 'bg-error-500'
})

const defensesData = computed(() => {
  const d = (sheet.value.defenses as Record<string, unknown>) || {}
  return {
    ac: (d.ac as number) ?? null,
    initiative: (d.initiative as number) ?? abilityMod(getAbilityTotal(abilityScores.value.dex)),
    speed: (d.speed as number) ?? 30,
  }
})

const getCharacterLevel = computed(() => {
  const basics = sheet.value.basics as Record<string, unknown> | undefined
  if (typeof basics?.level === 'number') return basics.level
  const classes = sheet.value.classes as Array<Record<string, unknown>> | undefined
  if (Array.isArray(classes)) return classes.reduce((s, c) => s + (typeof c.level === 'number' ? c.level : 0), 0) || null
  return null
})

const getCharacterClasses = computed(() => {
  const classes = sheet.value.classes as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(classes) || !classes.length) return null
  return classes.map((c) => (c.subclass ? `${c.name} (${c.subclass})` : c.name)).filter(Boolean).join(' / ')
})

const proficiencyBonus = computed(() => {
  const level = getCharacterLevel.value
  if (!level) return 2
  return Math.ceil(level / 4) + 1
})

// Derived display helpers
const backgroundData = computed(() => sheet.value.background as Record<string, unknown> | undefined)
const appearanceData = computed(() => sheet.value.appearance as Record<string, unknown> | undefined)

const hasBiographyData = computed(() => {
  const bg = backgroundData.value
  const ap = appearanceData.value
  const notes = sheet.value.notes as Record<string, unknown> | undefined
  return !!(bg?.name || (Array.isArray(bg?.traits) && (bg!.traits as string[]).length)
    || ap?.age || ap?.height || notes?.backstory)
})

const hasSpellData = computed(() => {
  const spells = sheet.value.spells as Record<string, unknown> | undefined
  if (!spells) return false
  return Object.keys(spells).some((k) => {
    const v = spells[k]
    return Array.isArray(v) ? v.length > 0 : !!v
  })
})

// ── Edit mode ─────────────────────────────────────────────────────────────────

const isEditing = ref(false)

// ── Forms ─────────────────────────────────────────────────────────────────────

const basicsForm = reactive({ name: '', playerName: '', level: 1, alignment: '', experience: 0, inspiration: false })
const abilityForm = reactive({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
const backgroundForm = reactive({ name: '', feature: '', traits: '', ideals: '', bonds: '', flaws: '' })
const appearanceForm = reactive({ age: '', height: '', weight: '', eyes: '', hair: '', skin: '', gender: '', faith: '' })
const notesForm = reactive({ backstory: '', other: '' })
const combatForm = reactive({ maxHp: 0, tempHp: 0, ac: 10, initiative: 0, speed: 30 })
const classesForm = ref<ClassEntry[]>([])
const newClassForm = reactive({ name: '', subclass: '', level: 1, hitDie: 8 })
const showAddClass = ref(false)
const spellsJson = ref('')

// HP current is always-interactive — tracked separately so it can save without edit mode
const hpCurrentDraft = ref(0)

const startEditing = () => {
  isEditing.value = true
}

const stopEditing = () => {
  isEditing.value = false
}

const openAddClass = () => {
  showAddClass.value = true
}

const cancelAddClass = () => {
  showAddClass.value = false
}

const syncFormState = () => {
  const basics = (sheet.value.basics as Record<string, unknown>) || {}
  basicsForm.name = (basics.name as string) || character.value?.name || ''
  basicsForm.playerName = (basics.playerName as string) || ''
  basicsForm.level = (basics.level as number) || getCharacterLevel.value || 1
  basicsForm.alignment = (basics.alignment as string) || ''
  basicsForm.experience = (basics.experience as number) || 0
  basicsForm.inspiration = Boolean(basics.inspiration)

  const as = (sheet.value.abilityScores as Record<string, unknown>) || {}
  abilityForm.str = getAbilityTotal(as.str)
  abilityForm.dex = getAbilityTotal(as.dex)
  abilityForm.con = getAbilityTotal(as.con)
  abilityForm.int = getAbilityTotal(as.int)
  abilityForm.wis = getAbilityTotal(as.wis)
  abilityForm.cha = getAbilityTotal(as.cha)

  const bg = (sheet.value.background as Record<string, unknown>) || {}
  backgroundForm.name = (bg.name as string) || ''
  backgroundForm.feature = (bg.feature as string) || ''
  backgroundForm.traits = Array.isArray(bg.traits) ? (bg.traits as string[]).join('\n') : ''
  backgroundForm.ideals = Array.isArray(bg.ideals) ? (bg.ideals as string[]).join('\n') : ''
  backgroundForm.bonds = Array.isArray(bg.bonds) ? (bg.bonds as string[]).join('\n') : ''
  backgroundForm.flaws = Array.isArray(bg.flaws) ? (bg.flaws as string[]).join('\n') : ''

  const ap = (sheet.value.appearance as Record<string, unknown>) || {}
  appearanceForm.age = ap.age !== undefined ? String(ap.age) : ''
  appearanceForm.height = (ap.height as string) || ''
  appearanceForm.weight = ap.weight !== undefined ? String(ap.weight) : ''
  appearanceForm.eyes = (ap.eyes as string) || ''
  appearanceForm.hair = (ap.hair as string) || ''
  appearanceForm.skin = (ap.skin as string) || ''
  appearanceForm.gender = (ap.gender as string) || ''
  appearanceForm.faith = (ap.faith as string) || ''

  const notes = (sheet.value.notes as Record<string, unknown>) || {}
  notesForm.backstory = (notes.backstory as string) || ''
  notesForm.other = (notes.other as string) || ''

  const hp = (sheet.value.hitPoints as Record<string, unknown>) || {}
  combatForm.maxHp = (hp.max as number) || 0
  combatForm.tempHp = (hp.temp as number) || 0
  hpCurrentDraft.value = (hp.current as number) ?? combatForm.maxHp

  const def = (sheet.value.defenses as Record<string, unknown>) || {}
  combatForm.ac = (def.ac as number) || 10
  combatForm.initiative = (def.initiative as number) || 0
  combatForm.speed = (def.speed as number) || 30

  const classes = sheet.value.classes as Array<Record<string, unknown>> | undefined
  classesForm.value = Array.isArray(classes)
    ? classes.map((c) => ({
        name: (c.name as string) || '',
        subclass: (c.subclass as string) || undefined,
        level: typeof c.level === 'number' ? c.level : undefined,
        hitDie: typeof c.hitDie === 'number' || typeof c.hitDie === 'string' ? c.hitDie : undefined,
      }))
    : []

  spellsJson.value = JSON.stringify(sheet.value.spells || {}, null, 2)
}

watch(() => character.value, () => { if (character.value) syncFormState() }, { immediate: true })

// ── Save handlers ─────────────────────────────────────────────────────────────

const savingSection = ref('')
const sectionError = ref('')

const saveSection = async (section: string, payload: unknown) => {
  if (!canEdit.value) return
  sectionError.value = ''
  savingSection.value = section
  try {
    await request(`/api/characters/${characterId.value}`, { method: 'PATCH', body: { section, payload } })
    await refresh()
  } catch (err) {
    sectionError.value = (err as Error & { message?: string }).message || 'Unable to save.'
  } finally {
    savingSection.value = ''
  }
}

const saveBasics = async () => {
  if (!canEdit.value) return
  await request(`/api/characters/${characterId.value}`, {
    method: 'PATCH',
    body: { name: basicsForm.name, status: character.value?.status || undefined },
  })
  await saveSection('BASICS', {
    name: basicsForm.name,
    playerName: basicsForm.playerName,
    level: basicsForm.level,
    alignment: basicsForm.alignment,
    experience: basicsForm.experience,
    inspiration: basicsForm.inspiration,
  })
}

// HP current: always-interactive, auto-saves without entering edit mode
const saveHpQuick = async () => {
  if (!canEdit.value) return
  if (hpCurrentDraft.value === hpData.value.current) return
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: {
        section: 'HIT_POINTS',
        payload: { max: hpData.value.max, current: hpCurrentDraft.value, temp: hpData.value.temp },
      },
    })
    await refresh()
  } catch { /* silent — the input stays editable */ }
}

// Inspiration: always-interactive toggle
const saveInspiration = async () => {
  if (!canEdit.value) return
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: { section: 'BASICS', payload: { ...basicsForm } },
    })
  } catch { /* silent */ }
}

const saveCombatStats = async () => {
  if (!canEdit.value) return
  sectionError.value = ''
  savingSection.value = 'COMBAT'
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: {
        section: 'HIT_POINTS',
        payload: { max: combatForm.maxHp, current: hpCurrentDraft.value, temp: combatForm.tempHp },
      },
    })
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: {
        section: 'DEFENSES',
        payload: { ac: combatForm.ac, initiative: combatForm.initiative, speed: combatForm.speed },
      },
    })
    await refresh()
  } catch (err) {
    sectionError.value = (err as Error & { message?: string }).message || 'Unable to save.'
  } finally {
    savingSection.value = ''
  }
}

const saveBiography = async () => {
  if (!canEdit.value) return
  sectionError.value = ''
  savingSection.value = 'BIOGRAPHY'
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: {
        section: 'BACKGROUND',
        payload: {
          name: backgroundForm.name,
          feature: backgroundForm.feature,
          traits: backgroundForm.traits.split('\n').filter(Boolean),
          ideals: backgroundForm.ideals.split('\n').filter(Boolean),
          bonds: backgroundForm.bonds.split('\n').filter(Boolean),
          flaws: backgroundForm.flaws.split('\n').filter(Boolean),
        },
      },
    })
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: {
        section: 'APPEARANCE',
        payload: {
          age: appearanceForm.age ? Number(appearanceForm.age) || appearanceForm.age : undefined,
          height: appearanceForm.height || undefined,
          weight: appearanceForm.weight ? Number(appearanceForm.weight) || appearanceForm.weight : undefined,
          eyes: appearanceForm.eyes || undefined,
          hair: appearanceForm.hair || undefined,
          skin: appearanceForm.skin || undefined,
          gender: appearanceForm.gender || undefined,
          faith: appearanceForm.faith || undefined,
        },
      },
    })
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: { section: 'NOTES', payload: { backstory: notesForm.backstory, other: notesForm.other } },
    })
    await refresh()
  } catch (err) {
    sectionError.value = (err as Error & { message?: string }).message || 'Unable to save.'
  } finally {
    savingSection.value = ''
  }
}

const removeClassEntry = (index: number) => {
  classesForm.value.splice(index, 1)
}

const addClassEntry = () => {
  if (!newClassForm.name.trim()) return
  classesForm.value.push({
    name: newClassForm.name.trim(),
    subclass: newClassForm.subclass.trim() || undefined,
    level: newClassForm.level,
    hitDie: newClassForm.hitDie,
  })
  newClassForm.name = ''
  newClassForm.subclass = ''
  newClassForm.level = 1
  newClassForm.hitDie = 8
  showAddClass.value = false
}

const parseJson = (v: string, fallback: unknown) => { try { return JSON.parse(v) } catch { return fallback } }

// ── Import ─────────────────────────────────────────────────────────────────────

const isImportOpen = ref(false)
const importError = ref('')
const isImporting = ref(false)

const importCharacter = async (payload: CharacterImportPayload) => {
  importError.value = ''
  isImporting.value = true
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: { action: 'import', ...payload },
    })
    isImportOpen.value = false
    await refresh()
  } catch (err) {
    importError.value = getCharacterImportErrorMessage(err, 'Unable to import character.')
  } finally {
    isImporting.value = false
  }
}

const refreshImport = async (payload: CharacterImportRefreshPayload) => {
  importError.value = ''
  isImporting.value = true
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: { action: 'refresh-import', ...payload },
    })
    await refresh()
  } catch (err) {
    importError.value = getCharacterImportErrorMessage(err, 'Unable to refresh import.')
  } finally {
    isImporting.value = false
  }
}

const deleteCharacter = async () => {
  if (!canEdit.value) return
  await request(`/api/characters/${characterId.value}`, { method: 'DELETE' })
  router.push('/characters')
}

// ── Campaign links ─────────────────────────────────────────────────────────────

const statusOptions = [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]
const attachCampaignId = ref('')

const attachToCampaign = async () => {
  if (!canEdit.value || !attachCampaignId.value) return
  await request(`/api/campaigns/${attachCampaignId.value}/characters`, {
    method: 'POST',
    body: { characterId: characterId.value },
  })
  attachCampaignId.value = ''
  await refresh()
}

const updateCampaignLink = async (link: CampaignLink, status: CampaignLink['status']) => {
  if (!canEdit.value) return
  await request(`/api/campaigns/${link.campaignId}/characters/${link.characterId}`, {
    method: 'PATCH',
    body: { status },
  })
  await refresh()
}

const removeFromCampaignWithClose = async (link: CampaignLink, close: () => void) => {
  if (!canEdit.value) return
  await request(`/api/campaigns/${link.campaignId}/characters/${link.characterId}`, { method: 'DELETE' })
  await refresh()
  close()
}
</script>

<template>
  <UPage>
    <div class="space-y-5">
      <UCard v-if="pending" class="h-40 animate-pulse" />
      <UCard v-else-if="error" class="py-8 text-center">
        <p class="text-sm text-error">Unable to load character.</p>
        <UButton class="mt-4" variant="outline" @click="() => refresh()">Try again</UButton>
      </UCard>

      <div v-else-if="character" class="space-y-5">
        <SharedReadOnlyAlert
          v-if="!canEdit"
          description="This character is shared through campaign membership. Only the owner can edit."
        />

        <!-- ══ HERO ═══════════════════════════════════════════════════════════ -->
        <div class="relative overflow-hidden rounded-md border border-default bg-elevated">
          <div class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary-500/80 to-transparent" />

          <div class="space-y-5 p-5 sm:p-6">
            <!-- Identity row -->
            <div class="flex flex-wrap items-start gap-5">
              <!-- Portrait -->
              <div class="relative shrink-0">
                <UAvatar
                  :src="character.portraitUrl || undefined"
                  :alt="character.name"
                  icon="i-lucide-user"
                  size="2xl"
                  class="ring-2 ring-primary-500/30 ring-offset-2 ring-offset-elevated"
                />
                <div
                  v-if="getCharacterLevel"
                  class="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-elevated bg-primary-500 font-display text-xs font-bold text-neutral-950"
                >
                  {{ getCharacterLevel }}
                </div>
              </div>

              <!-- View mode: read-only identity -->
              <div v-if="!isEditing" class="min-w-0 flex-1">
                <p class="text-[10px] font-display uppercase tracking-[0.3em] text-dimmed">Character</p>
                <h1 class="mt-0.5 font-display text-3xl font-semibold tracking-tight text-highlighted">
                  {{ character.name }}
                </h1>
                <p
                  v-if="getCharacterClasses || (sheet.race as Record<string,unknown>)?.name"
                  class="mt-1 text-[11px] font-display uppercase tracking-[0.14em] text-dimmed"
                >
                  <span v-if="getCharacterClasses">{{ getCharacterClasses }}</span>
                  <span v-if="getCharacterClasses && (sheet.race as Record<string,unknown>)?.name" class="mx-1.5 opacity-40">·</span>
                  <span v-if="(sheet.race as Record<string,unknown>)?.name">{{ (sheet.race as Record<string,unknown>).name as string }}</span>
                </p>
                <p v-if="basicsForm.playerName" class="mt-0.5 text-[11px] text-dimmed">
                  Played by {{ basicsForm.playerName }}
                </p>
                <div class="mt-2.5 flex flex-wrap items-center gap-2">
                  <UBadge v-if="(sheet.background as Record<string,unknown>)?.name" variant="subtle" color="neutral" size="sm">
                    {{ (sheet.background as Record<string,unknown>).name as string }}
                  </UBadge>
                  <UBadge v-if="basicsForm.alignment" variant="subtle" color="neutral" size="sm">
                    {{ basicsForm.alignment }}
                  </UBadge>
                  <UBadge v-if="basicsForm.experience" variant="subtle" color="neutral" size="sm">
                    {{ basicsForm.experience.toLocaleString() }} XP
                  </UBadge>
                  <!-- Inspiration: always-interactive toggle -->
                  <button
                    v-if="canEdit || basicsForm.inspiration"
                    class="flex cursor-pointer items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-display uppercase tracking-widest transition-colors"
                    :class="basicsForm.inspiration
                      ? 'border-warning-600/50 bg-warning-500/15 text-warning-300'
                      : 'border-default bg-transparent text-dimmed hover:border-accented hover:text-muted'"
                    :disabled="!canEdit"
                    @click="basicsForm.inspiration = !basicsForm.inspiration; saveInspiration()"
                  >
                    <UIcon name="i-lucide-sparkles" class="h-3 w-3" />
                    Inspired
                  </button>
                </div>
              </div>

              <!-- Edit mode: identity form inline -->
              <div v-else class="min-w-0 flex-1 space-y-3">
                <p class="text-[10px] font-display uppercase tracking-[0.3em] text-dimmed">Editing identity</p>
                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="sm:col-span-2">
                    <label class="mb-1 block text-xs text-muted">Character name</label>
                    <UInput v-model="basicsForm.name" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Player name</label>
                    <UInput v-model="basicsForm.playerName" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Alignment</label>
                    <UInput v-model="basicsForm.alignment" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Level</label>
                    <UInput v-model.number="basicsForm.level" type="number" min="1" max="20" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Experience points</label>
                    <UInput v-model.number="basicsForm.experience" type="number" min="0" />
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <USwitch v-model="basicsForm.inspiration" />
                  <span class="text-sm text-muted">Inspiration</span>
                </div>
                <UButton size="sm" :loading="savingSection === 'BASICS'" @click="saveBasics">
                  Save identity
                </UButton>
              </div>

              <!-- Action buttons -->
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton v-if="!isEditing && canEdit" size="sm" variant="ghost" @click="startEditing">
                  <UIcon name="i-lucide-pencil" class="mr-1.5 h-3.5 w-3.5" />
                  Edit sheet
                </UButton>
                <UButton v-if="isEditing" size="sm" variant="ghost" @click="stopEditing">
                  Done editing
                </UButton>
                <UButton size="sm" variant="outline" @click="() => { importError = ''; isImportOpen = true }">
                  <UIcon name="i-lucide-download" class="mr-1.5 h-3.5 w-3.5" />
                  Import
                </UButton>
                <SharedConfirmActionPopover
                  message="Delete this character permanently?"
                  confirm-label="Delete"
                  confirm-icon="i-lucide-trash-2"
                  :disabled="!canEdit"
                  @confirm="({ close }) => { deleteCharacter(); close() }"
                >
                  <template #trigger>
                    <UButton size="sm" color="error" variant="ghost" :disabled="!canEdit">Delete</UButton>
                  </template>
                </SharedConfirmActionPopover>
              </div>
            </div>

            <!-- Ornamental divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-default" />
              <div class="flex gap-1">
                <div class="h-1 w-1 rounded-full bg-primary-500/40" />
                <div class="h-1 w-1 rounded-full bg-primary-500/80" />
                <div class="h-1 w-1 rounded-full bg-primary-500/40" />
              </div>
              <div class="flex-1 border-t border-default" />
            </div>

            <!-- Ability Scores ───────────────────────────────────────────────── -->
            <!-- View mode: 6 stat boxes in a row -->
            <div v-if="!isEditing" class="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <div
                v-for="ab in abilities"
                :key="ab.key"
                class="flex flex-col items-center rounded-lg border border-default bg-accented p-2.5 text-center"
              >
                <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">{{ ab.label }}</p>
                <p class="my-1 font-display text-2xl font-bold text-highlighted">{{ getAbilityTotal(abilityScores[ab.key]) }}</p>
                <div
                  class="w-full rounded border px-1.5 py-0.5 text-center text-xs font-semibold font-display"
                  :class="abilityMod(getAbilityTotal(abilityScores[ab.key])) >= 0
                    ? 'border-success-700/40 bg-success-500/10 text-success-400'
                    : 'border-error-700/40 bg-error-500/10 text-error-400'"
                >
                  {{ fmtMod(abilityMod(getAbilityTotal(abilityScores[ab.key]))) }}
                </div>
              </div>
            </div>
            <!-- Edit mode: ability score inputs -->
            <div v-else class="space-y-3">
              <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Ability Scores</p>
              <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <div
                  v-for="ab in abilities"
                  :key="ab.key"
                  class="flex flex-col items-center rounded-lg border border-default bg-accented p-2.5 text-center"
                >
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">{{ ab.label }}</p>
                  <UInput
                    v-model.number="(abilityForm as Record<string,number>)[ab.key]"
                    type="number"
                    min="1"
                    max="30"
                    class="my-1 text-center font-display"
                  />
                  <div
                    class="w-full rounded border px-1.5 py-0.5 text-center text-xs font-semibold font-display"
                    :class="abilityMod(((abilityForm as Record<string,number>)[ab.key] ?? 10)) >= 0
                      ? 'border-success-700/40 bg-success-500/10 text-success-400'
                      : 'border-error-700/40 bg-error-500/10 text-error-400'"
                  >
                    {{ fmtMod(abilityMod(((abilityForm as Record<string,number>)[ab.key] ?? 10))) }}
                  </div>
                </div>
              </div>
              <UButton size="sm" :loading="savingSection === 'ABILITY_SCORES'" @click="saveSection('ABILITY_SCORES', { ...abilityForm })">
                Save abilities
              </UButton>
            </div>

            <!-- Ornamental divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-default" />
              <div class="flex gap-1">
                <div class="h-1 w-1 rounded-full bg-primary-500/40" />
                <div class="h-1 w-1 rounded-full bg-primary-500/80" />
                <div class="h-1 w-1 rounded-full bg-primary-500/40" />
              </div>
              <div class="flex-1 border-t border-default" />
            </div>

            <!-- Combat stats ─────────────────────────────────────────────────── -->
            <!-- View mode: full-width HP bar + 4 stat tiles -->
            <div v-if="!isEditing" class="space-y-2.5">
              <!-- HP: always-interactive, horizontal bar -->
              <div class="rounded-lg border border-default bg-accented px-4 py-3">
                <div class="flex items-center gap-4">
                  <div class="shrink-0">
                    <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Hit Points</p>
                    <div class="mt-1 flex items-baseline gap-1.5">
                      <input
                        v-model.number="hpCurrentDraft"
                        type="number"
                        class="w-14 appearance-none bg-transparent font-display text-2xl font-bold text-highlighted outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        :readonly="!canEdit"
                        @blur="saveHpQuick"
                        @keydown.enter.prevent="saveHpQuick"
                      >
                      <span class="text-sm text-dimmed">/ {{ hpData.max }}</span>
                      <span v-if="hpData.temp > 0" class="text-xs font-semibold text-success-400">+{{ hpData.temp }}</span>
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="h-2 overflow-hidden rounded-full bg-elevated">
                      <div class="h-full rounded-full transition-all duration-500" :class="hpBarColor" :style="{ width: `${hpData.percent}%` }" />
                    </div>
                    <p class="mt-1 text-right text-[9px] text-dimmed">{{ hpData.percent }}%</p>
                  </div>
                </div>
              </div>
              <!-- AC, Initiative, Speed, Prof Bonus -->
              <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div class="flex flex-col items-center justify-center rounded-lg border border-default bg-accented p-3 text-center">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">AC</p>
                  <p class="mt-1 font-display text-2xl font-bold text-highlighted">{{ defensesData.ac ?? '—' }}</p>
                </div>
                <div class="flex flex-col items-center justify-center rounded-lg border border-default bg-accented p-3 text-center">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Initiative</p>
                  <p class="mt-1 font-display text-2xl font-bold text-highlighted">{{ fmtMod(defensesData.initiative) }}</p>
                </div>
                <div class="flex flex-col items-center justify-center rounded-lg border border-default bg-accented p-3 text-center">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Speed</p>
                  <p class="mt-1 font-display text-2xl font-bold text-highlighted">{{ defensesData.speed }}<span class="text-base font-normal text-dimmed"> ft</span></p>
                </div>
                <div class="flex flex-col items-center justify-center rounded-lg border border-default bg-accented p-3 text-center">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Prof. Bonus</p>
                  <p class="mt-1 font-display text-2xl font-bold text-highlighted">+{{ proficiencyBonus }}</p>
                </div>
              </div>
            </div>

            <!-- Edit mode: combat stat inputs -->
            <div v-else class="space-y-3">
              <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Combat stats</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <label class="mb-1 block text-xs text-muted">Max HP</label>
                  <UInput v-model.number="combatForm.maxHp" type="number" min="1" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">Temp HP</label>
                  <UInput v-model.number="combatForm.tempHp" type="number" min="0" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">Armor Class</label>
                  <UInput v-model.number="combatForm.ac" type="number" min="1" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">Initiative</label>
                  <UInput v-model.number="combatForm.initiative" type="number" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">Speed (ft.)</label>
                  <UInput v-model.number="combatForm.speed" type="number" min="0" />
                </div>
              </div>
              <UButton size="sm" :loading="savingSection === 'COMBAT'" @click="saveCombatStats">
                Save combat stats
              </UButton>
            </div>
          </div>
        </div>

        <!-- ══ MAIN GRID ══════════════════════════════════════════════════════ -->
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">

          <!-- ── Classes + Biography (left column) ─────────────────────── -->
          <div class="space-y-5">

            <!-- Classes card -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Classes</p>
                  <UButton v-if="isEditing && !showAddClass" size="xs" variant="ghost" @click="openAddClass">
                    <UIcon name="i-lucide-plus" class="mr-1 h-3.5 w-3.5" />
                    Add
                  </UButton>
                </div>
              </template>

              <div class="space-y-2">
                <!-- View or edit: class cards -->
                <div
                  v-for="(cls, i) in classesForm"
                  :key="i"
                  class="group relative overflow-hidden rounded-lg border border-default bg-elevated/60 px-4 py-3 transition-colors hover:border-accented"
                >
                  <div class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary-500/40 to-transparent" />
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-swords" class="h-3.5 w-3.5 shrink-0 text-primary-400" />
                        <span class="font-display text-sm font-semibold text-highlighted">{{ cls.name }}</span>
                        <span v-if="cls.subclass" class="text-[11px] text-dimmed">— {{ cls.subclass }}</span>
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span v-if="cls.hitDie" class="text-[10px] font-display uppercase tracking-wider text-dimmed">d{{ cls.hitDie }}</span>
                      <UBadge v-if="cls.level" color="primary" variant="soft" size="sm">Lv {{ cls.level }}</UBadge>
                      <UButton
                        v-if="isEditing"
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-lucide-trash-2"
                        aria-label="Remove"
                        class="opacity-0 transition-opacity group-hover:opacity-100"
                        @click="removeClassEntry(i)"
                      />
                    </div>
                  </div>
                </div>

                <p v-if="!classesForm.length" class="py-2 text-center text-xs italic text-dimmed">
                  {{ isEditing ? 'No classes yet — use Add to create one.' : 'No class data.' }}
                </p>

                <!-- Add class form (edit mode only) -->
                <div v-if="isEditing && showAddClass" class="space-y-3 rounded-lg border border-default bg-accented/20 p-3">
                  <div class="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label class="mb-1 block text-xs text-muted">Class</label>
                      <UInput v-model="newClassForm.name" placeholder="e.g. Monk" size="sm" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Subclass</label>
                      <UInput v-model="newClassForm.subclass" placeholder="optional" size="sm" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Level</label>
                      <UInput v-model.number="newClassForm.level" type="number" min="1" max="20" size="sm" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Hit Die</label>
                      <UInput v-model.number="newClassForm.hitDie" type="number" placeholder="e.g. 8" size="sm" />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton size="xs" :disabled="!newClassForm.name.trim()" @click="addClassEntry">Add</UButton>
                    <UButton size="xs" variant="ghost" @click="cancelAddClass">Cancel</UButton>
                  </div>
                </div>
              </div>

              <template v-if="isEditing" #footer>
                <UButton size="sm" :loading="savingSection === 'CLASSES'" @click="saveSection('CLASSES', classesForm)">
                  Save classes
                </UButton>
              </template>
            </UCard>

            <!-- Biography card -->
            <UCard>
              <template #header>
                <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Biography</p>
              </template>

              <!-- VIEW MODE: readable display -->
              <div v-if="!isEditing" class="space-y-5">
                <!-- Empty state -->
                <p v-if="!hasBiographyData" class="py-2 text-center text-xs italic text-dimmed">
                  No biography recorded. Enter edit mode to add background details.
                </p>

                <!-- Background + feature -->
                <div v-if="backgroundData?.name || backgroundData?.feature" class="space-y-1">
                  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span class="font-display text-base font-semibold text-highlighted">
                      {{ backgroundData?.name || 'Unknown background' }}
                    </span>
                    <span v-if="backgroundData?.feature" class="text-xs text-muted">
                      Feature: {{ backgroundData.feature }}
                    </span>
                  </div>
                </div>

                <!-- Personality traits, ideals, bonds, flaws -->
                <div
                  v-if="backgroundForm.traits || backgroundForm.ideals || backgroundForm.bonds || backgroundForm.flaws"
                  class="grid gap-4 sm:grid-cols-2"
                >
                  <div v-if="backgroundForm.traits" class="space-y-1.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Personality</p>
                    <ul class="space-y-1">
                      <li
                        v-for="t in backgroundForm.traits.split('\n').filter(Boolean)"
                        :key="t"
                        class="flex gap-2 text-xs text-muted"
                      >
                        <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500/60" />
                        {{ t }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="backgroundForm.ideals" class="space-y-1.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Ideals</p>
                    <ul class="space-y-1">
                      <li
                        v-for="t in backgroundForm.ideals.split('\n').filter(Boolean)"
                        :key="t"
                        class="flex gap-2 text-xs text-muted"
                      >
                        <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500/60" />
                        {{ t }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="backgroundForm.bonds" class="space-y-1.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Bonds</p>
                    <ul class="space-y-1">
                      <li
                        v-for="t in backgroundForm.bonds.split('\n').filter(Boolean)"
                        :key="t"
                        class="flex gap-2 text-xs text-muted"
                      >
                        <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500/60" />
                        {{ t }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="backgroundForm.flaws" class="space-y-1.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Flaws</p>
                    <ul class="space-y-1">
                      <li
                        v-for="t in backgroundForm.flaws.split('\n').filter(Boolean)"
                        :key="t"
                        class="flex gap-2 text-xs text-muted"
                      >
                        <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500/60" />
                        {{ t }}
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Appearance -->
                <div
                  v-if="appearanceData && Object.values(appearanceData).some(Boolean)"
                  class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
                >
                  <div v-if="appearanceData.gender" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Gender</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.gender }}</p>
                  </div>
                  <div v-if="appearanceData.age" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Age</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.age }}</p>
                  </div>
                  <div v-if="appearanceData.height" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Height</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.height }}</p>
                  </div>
                  <div v-if="appearanceData.weight" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Weight</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.weight }}</p>
                  </div>
                  <div v-if="appearanceData.eyes" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Eyes</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.eyes }}</p>
                  </div>
                  <div v-if="appearanceData.hair" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Hair</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.hair }}</p>
                  </div>
                  <div v-if="appearanceData.skin" class="col-span-2 space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Skin</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.skin }}</p>
                  </div>
                  <div v-if="appearanceData.faith" class="space-y-0.5">
                    <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Faith</p>
                    <p class="text-xs text-highlighted">{{ appearanceData.faith }}</p>
                  </div>
                </div>

                <!-- Backstory -->
                <div v-if="notesForm.backstory" class="space-y-1.5">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Backstory</p>
                  <p class="text-xs leading-relaxed text-muted">{{ notesForm.backstory }}</p>
                </div>
                <div v-if="notesForm.other" class="space-y-1.5">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Notes</p>
                  <p class="text-xs leading-relaxed text-muted">{{ notesForm.other }}</p>
                </div>
              </div>

              <!-- EDIT MODE: form fields -->
              <div v-else class="space-y-5">
                <div class="space-y-3">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Background</p>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label class="mb-1 block text-xs text-muted">Background name</label>
                      <UInput v-model="backgroundForm.name" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Background feature</label>
                      <UInput v-model="backgroundForm.feature" placeholder="e.g. Heart of Darkness" />
                    </div>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label class="mb-1 block text-xs text-muted">Personality traits</label>
                      <UTextarea v-model="backgroundForm.traits" :rows="3" placeholder="One per line" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Ideals</label>
                      <UTextarea v-model="backgroundForm.ideals" :rows="3" placeholder="One per line" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Bonds</label>
                      <UTextarea v-model="backgroundForm.bonds" :rows="3" placeholder="One per line" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted">Flaws</label>
                      <UTextarea v-model="backgroundForm.flaws" :rows="3" placeholder="One per line" />
                    </div>
                  </div>
                </div>

                <div class="space-y-3">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Appearance</p>
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><label class="mb-1 block text-xs text-muted">Age</label><UInput v-model="appearanceForm.age" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Height</label><UInput v-model="appearanceForm.height" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Weight</label><UInput v-model="appearanceForm.weight" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Gender</label><UInput v-model="appearanceForm.gender" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Eyes</label><UInput v-model="appearanceForm.eyes" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Hair</label><UInput v-model="appearanceForm.hair" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Skin</label><UInput v-model="appearanceForm.skin" /></div>
                    <div><label class="mb-1 block text-xs text-muted">Faith</label><UInput v-model="appearanceForm.faith" /></div>
                  </div>
                </div>

                <div class="space-y-3">
                  <p class="text-[9px] font-display uppercase tracking-[0.18em] text-dimmed">Backstory & Notes</p>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Backstory</label>
                    <UTextarea v-model="notesForm.backstory" :rows="5" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-muted">Other notes</label>
                    <UTextarea v-model="notesForm.other" :rows="3" />
                  </div>
                </div>
              </div>

              <template v-if="isEditing" #footer>
                <UButton size="sm" :loading="savingSection === 'BIOGRAPHY'" @click="saveBiography">
                  Save biography
                </UButton>
              </template>
            </UCard>
          </div>

          <!-- ── Campaign sidebar (right column) ───────────────────────── -->
          <div class="space-y-4">
            <UCard>
              <template #header>
                <div>
                  <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Campaign links</p>
                  <p class="mt-0.5 text-xs text-muted">Manage membership</p>
                </div>
              </template>
              <div class="space-y-3">
                <div v-if="character.campaignLinks?.length" class="space-y-2">
                  <div
                    v-for="link in character.campaignLinks"
                    :key="link.id"
                    class="space-y-2 rounded-lg border border-default bg-accented/30 px-3 py-2.5"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="min-w-0 truncate text-sm font-semibold text-highlighted">{{ link.campaign.name }}</p>
                      <UTooltip text="Open campaign" :content="{ side: 'left' }">
                        <UButton :to="`/campaigns/${link.campaignId}`" size="xs" variant="ghost" icon="i-lucide-square-arrow-out-up-right" aria-label="Open campaign" />
                      </UTooltip>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <USelect
                        :items="statusOptions"
                        :model-value="link.status"
                        size="xs"
                        class="w-full max-w-32"
                        :disabled="!canEdit"
                        @update:model-value="(v) => updateCampaignLink(link, v as CampaignLink['status'])"
                      />
                      <SharedConfirmActionPopover
                        message="Remove campaign link?"
                        side="left"
                        align="end"
                        content-class="w-64 p-3"
                        confirm-label="Remove"
                        confirm-icon="i-lucide-trash-2"
                        :disabled="!canEdit"
                        @confirm="({ close }) => removeFromCampaignWithClose(link, close)"
                      >
                        <template #trigger>
                          <UTooltip text="Remove link" :content="{ side: 'left' }">
                            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :disabled="!canEdit" aria-label="Remove link" />
                          </UTooltip>
                        </template>
                        <template #content>
                          <div class="space-y-3">
                            <p class="text-sm text-muted">Remove {{ character?.name }} from "{{ link.campaign.name }}"?</p>
                            <UAlert
                              v-if="link.accessImpact?.warningRequired"
                              color="warning"
                              variant="subtle"
                              title="Shared access warning"
                              :description="`Up to ${link.accessImpact.impactedUserCount} member(s) may lose access.`"
                            />
                          </div>
                        </template>
                      </SharedConfirmActionPopover>
                    </div>
                  </div>
                </div>
                <p v-else class="py-2 text-center text-xs italic text-dimmed">Not linked to any campaigns.</p>
                <div class="flex flex-col gap-2">
                  <USelectMenu
                    v-model="attachCampaignId"
                    value-key="id"
                    label-key="name"
                    :items="campaigns || []"
                    placeholder="Select campaign…"
                    :disabled="!canEdit"
                  />
                  <UButton :disabled="!canEdit || !attachCampaignId" class="w-full" @click="attachToCampaign">
                    Attach to campaign
                  </UButton>
                </div>
              </div>
            </UCard>

            <!-- Species card (sidebar) -->
            <UCard v-if="(sheet.race as Record<string,unknown>)?.name">
              <template #header>
                <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Species</p>
              </template>
              <div class="space-y-2">
                <p class="font-display text-sm font-semibold text-highlighted">
                  {{ (sheet.race as Record<string,unknown>).name as string }}
                </p>
                <div
                  v-if="Array.isArray((sheet.race as Record<string,unknown>)?.traits) && ((sheet.race as Record<string,unknown>).traits as string[]).length"
                  class="flex flex-wrap gap-1.5"
                >
                  <UBadge
                    v-for="trait in (sheet.race as Record<string,unknown>).traits as string[]"
                    :key="trait"
                    variant="outline"
                    color="neutral"
                    size="sm"
                  >
                    {{ trait }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- ══ BOTTOM ROW: Spells + Inventory ═════════════════════════════ -->
        <div :class="['grid gap-5', hasSpellData || isEditing ? 'lg:grid-cols-2' : '']">

          <!-- Spells (only shown if there's data or in edit mode) -->
          <UCard v-if="hasSpellData || isEditing">
            <template #header>
              <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Spells</p>
            </template>

            <!-- View: formatted display -->
            <div v-if="!isEditing" class="space-y-4">
              <div v-if="(sheet.spells as Record<string,unknown>)?.slots" class="space-y-2">
                <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Spell Slots</p>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(slotData, level) in (sheet.spells as Record<string,unknown>).slots as Record<string,unknown>"
                    :key="level"
                    class="flex flex-col items-center rounded-lg border border-default bg-accented px-3 py-2 text-center"
                  >
                    <p class="text-[9px] font-display uppercase tracking-[0.12em] text-dimmed">Lv {{ level }}</p>
                    <p class="mt-0.5 font-display text-base font-bold text-highlighted">
                      {{ (slotData as Record<string,unknown>)?.remaining ?? slotData }}
                      <span class="text-xs text-dimmed">/ {{ (slotData as Record<string,unknown>)?.max ?? slotData }}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div v-if="Array.isArray((sheet.spells as Record<string,unknown>)?.prepared) && ((sheet.spells as Record<string,unknown>).prepared as unknown[]).length" class="space-y-1.5">
                <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Prepared</p>
                <div class="flex flex-wrap gap-1.5">
                  <UBadge v-for="spell in (sheet.spells as Record<string,unknown>).prepared as Record<string,unknown>[]" :key="String(spell.name || spell)" variant="soft" color="primary" size="sm">
                    {{ spell.name || spell }}
                  </UBadge>
                </div>
              </div>
              <div v-if="Array.isArray((sheet.spells as Record<string,unknown>)?.known) && ((sheet.spells as Record<string,unknown>).known as unknown[]).length" class="space-y-1.5">
                <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Known</p>
                <div class="flex flex-wrap gap-1.5">
                  <UBadge v-for="spell in (sheet.spells as Record<string,unknown>).known as Record<string,unknown>[]" :key="String(spell.name || spell)" variant="subtle" color="neutral" size="sm">
                    {{ spell.name || spell }}
                  </UBadge>
                </div>
              </div>
            </div>

            <!-- Edit: JSON editor -->
            <div v-else class="space-y-2">
              <UTextarea v-model="spellsJson" :rows="8" />
            </div>

            <template v-if="isEditing" #footer>
              <UButton size="sm" :loading="savingSection === 'SPELLS'" @click="saveSection('SPELLS', parseJson(spellsJson, {}))">
                Save spells
              </UButton>
            </template>
          </UCard>

          <!-- Inventory (always shown) -->
          <UCard>
            <template #header>
              <p class="text-[10px] font-display uppercase tracking-[0.22em] text-dimmed">Inventory</p>
            </template>

            <div class="space-y-5">
              <!-- Currency -->
              <div class="space-y-2">
                <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Currency</p>
                <div class="grid grid-cols-5 gap-2">
                  <div
                    v-for="coin in [
                      { key: 'pp', abbr: 'PP', textClass: 'text-info-300', borderClass: 'border-info-700/40 bg-info-500/8' },
                      { key: 'gp', abbr: 'GP', textClass: 'text-warning-300', borderClass: 'border-warning-700/40 bg-warning-500/8' },
                      { key: 'ep', abbr: 'EP', textClass: 'text-success-300', borderClass: 'border-success-700/40 bg-success-500/8' },
                      { key: 'sp', abbr: 'SP', textClass: 'text-neutral-400', borderClass: 'border-neutral-600/40 bg-neutral-500/8' },
                      { key: 'cp', abbr: 'CP', textClass: 'text-orange-300', borderClass: 'border-orange-800/40 bg-orange-500/8' },
                    ]"
                    :key="coin.key"
                    class="flex flex-col items-center rounded-lg border p-2.5 text-center"
                    :class="coin.borderClass"
                  >
                    <p class="text-[9px] font-display uppercase tracking-[0.14em]" :class="coin.textClass">{{ coin.abbr }}</p>
                    <p class="mt-0.5 font-display text-lg font-bold text-highlighted">
                      {{ (((sheet.inventory as Record<string,unknown>)?.currency as Record<string,unknown>) || {})[coin.key] ?? 0 }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Items -->
              <div class="space-y-2">
                <p class="text-[9px] font-display uppercase tracking-[0.14em] text-dimmed">Items</p>
                <div
                  v-if="Array.isArray(sheet.equipment) && (sheet.equipment as unknown[]).length"
                  class="divide-y divide-default overflow-hidden rounded-lg border border-default"
                >
                  <div
                    v-for="(item, i) in sheet.equipment as Record<string,unknown>[]"
                    :key="i"
                    class="flex items-center justify-between bg-elevated/30 px-3 py-2 text-sm transition-colors hover:bg-accented/30"
                  >
                    <div class="flex min-w-0 items-center gap-2.5">
                      <UIcon
                        :name="item.equipped ? 'i-lucide-shield-check' : 'i-lucide-package'"
                        class="h-3.5 w-3.5 shrink-0"
                        :class="item.equipped ? 'text-primary-400' : 'text-dimmed'"
                      />
                      <span class="truncate font-medium text-highlighted">{{ item.name || 'Unknown item' }}</span>
                      <UBadge v-if="item.type" variant="subtle" size="xs" color="neutral">{{ item.type }}</UBadge>
                      <UBadge v-if="item.attuned" variant="soft" size="xs" color="warning">Attuned</UBadge>
                    </div>
                    <span class="shrink-0 pl-2 text-xs text-dimmed">× {{ item.qty ?? 1 }}</span>
                  </div>
                </div>
                <p v-else class="text-center text-xs italic text-dimmed">No items recorded.</p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Global error -->
        <p v-if="sectionError" class="text-sm text-error">{{ sectionError }}</p>
      </div>
    </div>

    <CharactersImportModal
      v-model:open="isImportOpen"
      :loading="isImporting"
      :error="importError"
      default-mode="SECTIONS"
      :show-refresh-button="true"
      @submit="importCharacter"
      @refresh="refreshImport"
    />
  </UPage>
</template>
