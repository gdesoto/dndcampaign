<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ layout: 'docs' })

const {
  dndCharacters,
  dndConditions,
  dndCombatants,
  dndFactions,
  dndSpellSlots,
  dndItems,
  dndLocations,
  dndThreatClocks,
  dndDetailedQuest,
  dndQuestList,
  dndSessions,
  dndMilestones,
  dndAudioTracks,
  dndNpcList,
} = useUxStyleGuideContent()

// ---- helpers ----

const hpPercent = (hp: number, max: number) => Math.round((hp / max) * 100)

const hpBarClass = (hp: number, max: number) => {
  const pct = hpPercent(hp, max)
  if (pct > 50) return 'bg-success-500'
  if (pct > 25) return 'bg-warning-500'
  return 'bg-error-500'
}

const rarityColor = (rarity: string) => {
  const map: Record<string, 'neutral' | 'success' | 'info' | 'primary' | 'warning' | 'error'> = {
    common: 'neutral',
    uncommon: 'success',
    rare: 'info',
    'very rare': 'primary',
    legendary: 'warning',
    artifact: 'error',
  }
  return map[rarity] ?? 'neutral'
}

const rarityVariant = (rarity: string): 'outline' | 'solid' | 'soft' => {
  if (rarity === 'legendary' || rarity === 'artifact') return 'solid'
  if (rarity === 'very rare' || rarity === 'rare') return 'soft'
  return 'outline'
}

const locationStatusColor = (status: string) => {
  const map: Record<string, 'success' | 'info' | 'neutral' | 'error'> = {
    explored: 'success',
    known: 'info',
    rumored: 'neutral',
    dangerous: 'error',
  }
  return map[status] ?? 'neutral'
}

const factionRelationColor = (relation: string) => {
  const map: Record<string, 'success' | 'neutral' | 'error' | 'warning'> = {
    allied: 'success',
    neutral: 'neutral',
    hostile: 'error',
    unknown: 'warning',
  }
  return map[relation] ?? 'neutral'
}

const influenceLabel = (influence: string) => {
  const map: Record<string, string> = {
    minor: 'Minor',
    moderate: 'Moderate',
    major: 'Major',
    dominant: 'Dominant',
  }
  return map[influence] ?? influence
}

const combatantTypeColor = (type: string) => {
  if (type === 'pc') return 'text-success-400'
  if (type === 'npc') return 'text-info-400'
  return 'text-error-400'
}

const combatantTypeLabel = (type: string) => {
  if (type === 'pc') return 'PC'
  if (type === 'npc') return 'NPC'
  return 'Monster'
}

const clockUrgencyBg = (urgency: string) => {
  if (urgency === 'error') return 'bg-error-500'
  if (urgency === 'warning') return 'bg-warning-500'
  return 'bg-info-500'
}

const clockUrgencyBorder = (urgency: string) => {
  if (urgency === 'error') return 'border-error-600'
  if (urgency === 'warning') return 'border-warning-600'
  return 'border-info-600'
}

const clockUrgencyEmpty = (urgency: string) => {
  if (urgency === 'error') return 'border-error-900/50'
  if (urgency === 'warning') return 'border-warning-900/50'
  return 'border-info-900/50'
}

const dangerLabel = (level: number) => {
  if (level >= 5) return 'Lethal'
  if (level >= 4) return 'Severe'
  if (level >= 3) return 'Moderate'
  if (level >= 2) return 'Low'
  return 'Safe'
}

const dangerColor = (level: number): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
  if (level >= 5) return 'error'
  if (level >= 3) return 'warning'
  if (level >= 2) return 'info'
  return 'success'
}

const sessionStatusColor = (status: string): 'primary' | 'neutral' | 'warning' => {
  if (status === 'upcoming') return 'primary'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

const questStatusColor = (status: string): 'success' | 'error' | 'info' | 'neutral' => {
  if (status === 'active') return 'success'
  if (status === 'blocked') return 'error'
  if (status === 'ready') return 'info'
  return 'neutral'
}

const questUrgencyIcon = (urgency: string) => {
  if (urgency === 'critical') return 'i-lucide-flame'
  if (urgency === 'high') return 'i-lucide-alert-triangle'
  if (urgency === 'normal') return 'i-lucide-minus'
  return 'i-lucide-arrow-down'
}

const questUrgencyColor = (urgency: string): 'error' | 'warning' | 'neutral' | 'info' => {
  if (urgency === 'critical') return 'error'
  if (urgency === 'high') return 'warning'
  if (urgency === 'normal') return 'neutral'
  return 'info'
}

const npcRelationColor = (relation: string): 'success' | 'neutral' | 'warning' | 'error' => {
  if (relation === 'ally') return 'success'
  if (relation === 'suspect') return 'warning'
  if (relation === 'hostile') return 'error'
  return 'neutral'
}

const activeTrackIndex = ref<number | null>(null)
const toggleTrack = (idx: number) => {
  activeTrackIndex.value = activeTrackIndex.value === idx ? null : idx
}

const tocLinks: NavigationMenuItem[] = [
  { label: 'Character Cards', to: '#character-cards', icon: 'i-lucide-user' },
  { label: 'Party Strip', to: '#party-strip', icon: 'i-lucide-users' },
  { label: 'Quest Log', to: '#quest-log', icon: 'i-lucide-scroll-text' },
  { label: 'Initiative Tracker', to: '#initiative-tracker', icon: 'i-lucide-swords' },
  { label: 'Condition Reference', to: '#conditions', icon: 'i-lucide-activity' },
  { label: 'Faction Cards', to: '#faction-cards', icon: 'i-lucide-flag' },
  { label: 'Spell Slot Tracker', to: '#spell-slots', icon: 'i-lucide-wand-2' },
  { label: 'Threat Clocks', to: '#threat-clocks', icon: 'i-lucide-clock' },
  { label: 'Loot & Items', to: '#loot-items', icon: 'i-lucide-gem' },
  { label: 'Location Cards', to: '#location-cards', icon: 'i-lucide-map-pin' },
  { label: 'Session List', to: '#session-list', icon: 'i-lucide-calendar' },
  { label: 'Quest List', to: '#quest-list', icon: 'i-lucide-list-checks' },
  { label: 'NPC List', to: '#npc-list', icon: 'i-lucide-contact' },
  { label: 'Location List', to: '#location-list', icon: 'i-lucide-map' },
  { label: 'Milestones', to: '#milestones', icon: 'i-lucide-trophy' },
  { label: 'Audio Playlist', to: '#audio-playlist', icon: 'i-lucide-disc-3' },
]
</script>

<template>
  <UPage>
    <UPageHeader
      title="D&D Components"
      headline="UX Style Guide"
      description="Character cards, quest logs, initiative trackers, faction displays, and other D&D-specific shared components."
    />

    <UPageBody class="space-y-8">
      <!-- ── Character Cards ─────────────────────────────────────────── -->
      <section id="character-cards" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Character Cards</h2>
          <p class="text-sm text-muted">
            Full and compact character card variants. Prioritize HP, AC, and active conditions at a glance.
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <!-- Full character card -->
          <UCard
            v-for="char in dndCharacters.slice(0, 1)"
            :key="char.name"
            class="self-start"
          >
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <UAvatar :icon="char.icon" :alt="char.name" size="lg" />
                  <div class="space-y-0.5">
                    <h3 class="font-display text-lg text-highlighted">{{ char.name }}</h3>
                    <p class="text-[11px] uppercase tracking-[0.18em] text-dimmed">
                      {{ char.class }} · {{ char.subclass }}
                    </p>
                    <p class="text-[11px] uppercase tracking-[0.14em] text-dimmed">{{ char.race }}</p>
                  </div>
                </div>
                <UBadge color="primary" variant="soft" :label="`Lv ${char.level}`" class="shrink-0" />
              </div>
            </template>

            <div class="space-y-4">
              <!-- HP bar -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <p class="text-[10px] uppercase tracking-[0.18em] text-dimmed">Hit Points</p>
                  <p class="text-sm font-medium text-highlighted">
                    {{ char.hp }} <span class="text-dimmed">/ {{ char.maxHp }}</span>
                  </p>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="hpBarClass(char.hp, char.maxHp)"
                    :style="{ width: `${hpPercent(char.hp, char.maxHp)}%` }"
                  />
                </div>
              </div>

              <!-- Stat row -->
              <div class="flex gap-2">
                <div class="flex flex-1 flex-col items-center rounded-lg border border-default bg-accented py-2 px-1">
                  <p class="text-[9px] uppercase tracking-[0.12em] text-dimmed">AC</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.ac }}</p>
                </div>
                <div class="flex flex-1 flex-col items-center rounded-lg border border-default bg-accented py-2 px-1">
                  <p class="text-[9px] uppercase tracking-[0.12em] text-dimmed">Speed</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.speed }}'</p>
                </div>
                <div class="flex flex-1 flex-col items-center rounded-lg border border-default bg-accented py-2 px-1">
                  <p class="text-[9px] uppercase tracking-[0.12em] text-dimmed">Perc.</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.passivePerception }}</p>
                </div>
                <div class="flex flex-1 flex-col items-center rounded-lg border border-default bg-accented py-2 px-1">
                  <p class="text-[9px] uppercase tracking-[0.12em] text-dimmed">Prof.</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">+{{ char.proficiencyBonus }}</p>
                </div>
              </div>

              <!-- Conditions -->
              <div v-if="char.conditions.length" class="flex flex-wrap gap-1.5">
                <UBadge
                  v-for="cond in char.conditions"
                  :key="cond"
                  :label="cond"
                  color="warning"
                  variant="soft"
                  size="xs"
                />
              </div>
              <p v-else class="text-xs text-dimmed italic">No active conditions</p>
            </div>

            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="solid" icon="i-lucide-user">View sheet</UButton>
                <UButton size="xs" variant="outline" icon="i-lucide-notebook-pen">Add note</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-pencil">Edit</UButton>
              </div>
            </template>
          </UCard>

          <!-- Vesper — low HP / multiple conditions -->
          <UCard
            v-for="char in dndCharacters.slice(3, 4)"
            :key="char.name"
            class="self-start"
          >
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <UAvatar :icon="char.icon" :alt="char.name" size="lg" />
                  <div class="space-y-0.5">
                    <h3 class="font-display text-lg text-highlighted">{{ char.name }}</h3>
                    <p class="text-[11px] uppercase tracking-[0.18em] text-dimmed">
                      {{ char.class }} · {{ char.subclass }}
                    </p>
                    <p class="text-[11px] uppercase tracking-[0.14em] text-dimmed">{{ char.race }}</p>
                  </div>
                </div>
                <UBadge color="primary" variant="soft" :label="`Lv ${char.level}`" class="shrink-0" />
              </div>
            </template>

            <div class="space-y-4">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <p class="text-[10px] uppercase tracking-[0.18em] text-dimmed">Hit Points</p>
                  <p class="text-sm font-medium text-highlighted">
                    {{ char.hp }} <span class="text-dimmed">/ {{ char.maxHp }}</span>
                  </p>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="hpBarClass(char.hp, char.maxHp)"
                    :style="{ width: `${hpPercent(char.hp, char.maxHp)}%` }"
                  />
                </div>
              </div>

              <div class="grid grid-cols-4 gap-2">
                <div class="rounded-lg border border-default bg-accented p-2 text-center">
                  <p class="text-[9px] uppercase tracking-[0.14em] text-dimmed">AC</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.ac }}</p>
                </div>
                <div class="rounded-lg border border-default bg-accented p-2 text-center">
                  <p class="text-[9px] uppercase tracking-[0.14em] text-dimmed">Speed</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.speed }}'</p>
                </div>
                <div class="rounded-lg border border-default bg-accented p-2 text-center">
                  <p class="text-[9px] uppercase tracking-[0.14em] text-dimmed">Perc.</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">{{ char.passivePerception }}</p>
                </div>
                <div class="rounded-lg border border-default bg-accented p-2 text-center">
                  <p class="text-[9px] uppercase tracking-[0.14em] text-dimmed">Prof.</p>
                  <p class="mt-0.5 font-display text-base text-highlighted">+{{ char.proficiencyBonus }}</p>
                </div>
              </div>

              <div v-if="char.conditions.length" class="flex flex-wrap gap-1.5">
                <UBadge
                  v-for="cond in char.conditions"
                  :key="cond"
                  :label="cond"
                  color="warning"
                  variant="soft"
                  size="xs"
                />
              </div>
            </div>

            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="solid" icon="i-lucide-user">View sheet</UButton>
                <UButton size="xs" variant="outline" icon="i-lucide-notebook-pen">Add note</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-pencil">Edit</UButton>
              </div>
            </template>
          </UCard>
        </div>
      </section>

      <!-- ── Party Strip ─────────────────────────────────────────────── -->
      <section id="party-strip" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Party Strip</h2>
          <p class="text-sm text-muted">
            Compact per-character tiles for session headers and encounter panels. Shows health state at a glance.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <UCard v-for="char in dndCharacters" :key="char.name" class="self-start">
            <div class="flex flex-col items-center gap-2 text-center">
              <UAvatar :icon="char.icon" :alt="char.name" size="md" />
              <div>
                <p class="font-display text-sm text-highlighted leading-tight">{{ char.name.split(' ')[0] }}</p>
                <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed mt-0.5">{{ char.class }}</p>
              </div>

              <!-- compact HP bar -->
              <div class="w-full space-y-1">
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                  <div
                    class="h-full rounded-full"
                    :class="hpBarClass(char.hp, char.maxHp)"
                    :style="{ width: `${hpPercent(char.hp, char.maxHp)}%` }"
                  />
                </div>
                <p class="text-[10px] text-dimmed">{{ char.hp }}<span class="opacity-50">/{{ char.maxHp }}</span></p>
              </div>

              <div v-if="char.conditions.length" class="flex flex-wrap justify-center gap-1">
                <UBadge
                  v-for="cond in char.conditions.slice(0, 2)"
                  :key="cond"
                  :label="cond"
                  color="warning"
                  variant="soft"
                  size="xs"
                  class="text-[9px]"
                />
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- ── Quest Log (Detailed) ────────────────────────────────────── -->
      <section id="quest-log" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Quest Log — Detailed</h2>
          <p class="text-sm text-muted">
            Objective checklist with patron attribution, reward preview, and next-hook callout.
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <!-- Main quest card -->
          <UCard class="self-start">
            <template #header>
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="font-display text-lg text-highlighted">{{ dndDetailedQuest.title }}</h3>
                  <UBadge color="success" variant="soft" label="Active" class="shrink-0" />
                </div>
                <div class="flex items-center gap-2">
                  <UAvatar :icon="dndDetailedQuest.patronIcon" :alt="dndDetailedQuest.patron" size="xs" />
                  <p class="text-[11px] uppercase tracking-[0.14em] text-dimmed">{{ dndDetailedQuest.patron }}</p>
                </div>
              </div>
            </template>

            <!-- Objectives -->
            <div class="space-y-2">
              <p class="text-[10px] uppercase tracking-[0.16em] text-dimmed">Objectives</p>
              <ul class="space-y-2">
                <li
                  v-for="obj in dndDetailedQuest.objectives"
                  :key="obj.text"
                  class="flex items-start gap-2.5"
                >
                  <div
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    :class="obj.complete
                      ? 'border-success-500 bg-success-500/20'
                      : 'border-[var(--ui-border)] bg-[var(--ui-bg)]'"
                  >
                    <UIcon
                      v-if="obj.complete"
                      name="i-lucide-check"
                      class="h-2.5 w-2.5 text-success-400"
                    />
                  </div>
                  <p
                    class="text-sm leading-5"
                    :class="obj.complete ? 'text-dimmed line-through' : 'text-muted'"
                  >{{ obj.text }}</p>
                </li>
              </ul>

              <!-- Progress bar -->
              <div class="mt-3 space-y-1">
                <div class="flex justify-between text-[10px] text-dimmed">
                  <span>Progress</span>
                  <span>{{ dndDetailedQuest.objectives.filter(o => o.complete).length }} / {{ dndDetailedQuest.objectives.length }}</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                  <div
                    class="h-full rounded-full bg-success-500 transition-all"
                    :style="{
                      width: `${(dndDetailedQuest.objectives.filter(o => o.complete).length / dndDetailedQuest.objectives.length) * 100}%`
                    }"
                  />
                </div>
              </div>
            </div>

            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="solid" icon="i-lucide-scroll-text">Open quest</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-pin">Pin to session</UButton>
              </div>
            </template>
          </UCard>

          <!-- Sidebar: reward + next hook -->
          <div class="space-y-3">
            <UCard class="self-start">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-gem" class="h-4 w-4 text-warning-400" />
                  <h3 class="font-display text-base text-highlighted">Reward</h3>
                </div>
              </template>
              <p class="text-sm leading-6 text-muted">{{ dndDetailedQuest.reward }}</p>
            </UCard>

            <UCard class="self-start border-l-2 border-l-warning-500/60">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-arrow-right-circle" class="h-4 w-4 text-warning-400" />
                  <h3 class="font-display text-base text-highlighted">Next Hook</h3>
                </div>
              </template>
              <p class="text-sm leading-6 text-muted italic">{{ dndDetailedQuest.nextHook }}</p>
            </UCard>
          </div>
        </div>
      </section>

      <!-- ── Initiative Tracker ──────────────────────────────────────── -->
      <section id="initiative-tracker" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Initiative Tracker</h2>
          <p class="text-sm text-muted">
            Turn-ordered combat list with HP bars, type labels, and inline condition chips.
            Highlight the active combatant without obscuring others.
          </p>
        </div>

        <UCard class="self-start">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-swords" class="h-4 w-4 text-error-400" />
                <h3 class="font-display text-base text-highlighted">Round 3 · Flooded Chapel</h3>
              </div>
              <UBadge color="error" variant="soft" label="Combat" icon="i-lucide-activity" />
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="(combatant, idx) in dndCombatants"
              :key="combatant.name"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors"
              :class="combatant.isActive ? 'rounded-lg bg-primary-500/10 px-3 -mx-3' : ''"
            >
              <!-- Initiative + turn marker -->
              <div class="flex w-8 shrink-0 flex-col items-center">
                <div
                  class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="combatant.isActive
                    ? 'bg-primary-500 text-white'
                    : 'bg-[var(--ui-bg-elevated)] text-dimmed'"
                >
                  {{ idx + 1 }}
                </div>
                <p class="mt-0.5 text-[9px] text-dimmed">{{ combatant.initiative }}</p>
              </div>

              <!-- Avatar + name -->
              <UAvatar :icon="combatant.icon" :alt="combatant.name" size="sm" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-medium text-highlighted">{{ combatant.name }}</p>
                  <span class="text-[9px] uppercase tracking-[0.12em]" :class="combatantTypeColor(combatant.type)">
                    {{ combatantTypeLabel(combatant.type) }}
                  </span>
                  <UIcon v-if="combatant.isActive" name="i-lucide-chevron-right" class="h-3 w-3 text-primary-400" />
                </div>

                <!-- HP bar -->
                <div class="flex items-center gap-2">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="hpBarClass(combatant.hp, combatant.maxHp)"
                      :style="{ width: `${hpPercent(combatant.hp, combatant.maxHp)}%` }"
                    />
                  </div>
                  <p class="shrink-0 text-[10px] tabular-nums text-muted">
                    {{ combatant.hp }}<span class="text-dimmed">/{{ combatant.maxHp }}</span>
                  </p>
                </div>

                <!-- Conditions -->
                <div v-if="combatant.conditions.length" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="cond in combatant.conditions"
                    :key="cond"
                    :label="cond"
                    :color="cond === 'Unconscious' ? 'error' : 'warning'"
                    variant="soft"
                    size="xs"
                  />
                </div>
              </div>

              <!-- AC chip -->
              <div class="shrink-0 text-center">
                <p class="text-[9px] uppercase tracking-[0.12em] text-dimmed">AC</p>
                <p class="font-display text-sm text-highlighted">{{ combatant.ac }}</p>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton size="xs" variant="outline" icon="i-lucide-skip-forward">End turn</UButton>
              <UButton size="xs" variant="ghost" icon="i-lucide-plus-circle">Add combatant</UButton>
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x-circle">End encounter</UButton>
            </div>
          </template>
        </UCard>
      </section>

      <!-- ── Condition Reference ────────────────────────────────────── -->
      <section id="conditions" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Condition Reference</h2>
          <p class="text-sm text-muted">
            All standard 5e conditions plus common DM-tracked states. Use color to convey severity at a glance.
          </p>
        </div>

        <UCard>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="cond in dndConditions"
              :key="cond.name"
              :label="cond.name"
              :color="cond.color"
              :icon="cond.icon"
              variant="soft"
            />
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-error-500/30 bg-error-500/5 p-3 space-y-1">
              <p class="text-[10px] uppercase tracking-[0.16em] text-error-400">Critical (red)</p>
              <p class="text-xs text-muted">Incapacitated, Paralyzed, Unconscious, Cursed — combat-ending or identity-threatening states.</p>
            </div>
            <div class="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 space-y-1">
              <p class="text-[10px] uppercase tracking-[0.16em] text-warning-400">Impaired (yellow)</p>
              <p class="text-xs text-muted">Exhaustion, Frightened, Stunned, Restrained — reduces capability but doesn't end the fight.</p>
            </div>
            <div class="rounded-lg border border-info-500/30 bg-info-500/5 p-3 space-y-1">
              <p class="text-[10px] uppercase tracking-[0.16em] text-info-400">Active / Positive (blue)</p>
              <p class="text-xs text-muted">Concentrating, Charmed, Invisible — states the player actively maintains or exploits.</p>
            </div>
          </div>
        </UCard>
      </section>

      <!-- ── Faction Cards ───────────────────────────────────────────── -->
      <section id="faction-cards" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Faction Cards</h2>
          <p class="text-sm text-muted">
            Show faction motto, territory, party relationship, and key NPC links. Use color to signal alliance.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <UCard
            v-for="faction in dndFactions"
            :key="faction.name"
            class="self-start dmvault-card"
          >
            <template #header>
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      :class="`border-${faction.color}-500/40 bg-${faction.color}-500/10`"
                    >
                      <UIcon :name="faction.icon" class="h-4 w-4" :class="`text-${faction.color}-400`" />
                    </div>
                    <h3 class="font-display text-base text-highlighted">{{ faction.name }}</h3>
                  </div>
                  <UBadge
                    :color="factionRelationColor(faction.relation)"
                    variant="soft"
                    :label="faction.relation"
                    size="xs"
                    class="shrink-0 capitalize"
                  />
                </div>
                <p class="text-xs italic text-dimmed">"{{ faction.motto }}"</p>
              </div>
            </template>

            <div class="space-y-3">
              <div class="space-y-1">
                <p class="text-[10px] uppercase tracking-[0.16em] text-dimmed">Territory</p>
                <p class="text-sm text-muted">{{ faction.territory }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-[10px] uppercase tracking-[0.16em] text-dimmed">Influence</p>
                <div class="flex items-center gap-1.5">
                  <div class="flex gap-0.5">
                    <div
                      v-for="i in 4"
                      :key="i"
                      class="h-1.5 w-4 rounded-sm"
                      :class="['minor', 'moderate', 'major', 'dominant'].indexOf(faction.influence) >= i - 1
                        ? `bg-${faction.color}-500`
                        : 'bg-[var(--ui-bg-elevated)]'"
                    />
                  </div>
                  <p class="text-xs text-dimmed">{{ influenceLabel(faction.influence) }}</p>
                </div>
              </div>
              <div class="space-y-1">
                <p class="text-[10px] uppercase tracking-[0.16em] text-dimmed">Key NPCs</p>
                <div class="flex flex-wrap gap-1.5">
                  <UBadge
                    v-for="npc in faction.keyNpcs"
                    :key="npc"
                    :label="npc"
                    color="neutral"
                    variant="outline"
                    size="xs"
                  />
                </div>
              </div>
            </div>

            <template #footer>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline">Open faction</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-link">Link quest</UButton>
              </div>
            </template>
          </UCard>
        </div>
      </section>

      <!-- ── Spell Slot Tracker ─────────────────────────────────────── -->
      <section id="spell-slots" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Spell Slot Tracker</h2>
          <p class="text-sm text-muted">
            Dot-grid visualization of remaining vs. used slots. Keep it compact and readable during live play.
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
          <UCard class="self-start">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <UAvatar icon="i-twemoji-crystal-ball" alt="Vesper" size="sm" />
                  <div>
                    <h3 class="font-display text-base text-highlighted">Vesper</h3>
                    <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">Wizard · Level 5</p>
                  </div>
                </div>
                <UButton size="xs" variant="soft" icon="i-lucide-moon">Short rest</UButton>
              </div>
            </template>

            <div class="space-y-3">
              <div
                v-for="slot in dndSpellSlots"
                :key="slot.level"
                class="flex items-center gap-4"
              >
                <p class="w-14 shrink-0 text-[10px] uppercase tracking-[0.16em] text-dimmed">
                  Level {{ slot.level }}
                </p>
                <div class="flex gap-1.5">
                  <div
                    v-for="i in slot.total"
                    :key="i"
                    class="h-4 w-4 rounded-full border-2 transition-colors"
                    :class="i <= (slot.total - slot.used)
                      ? 'border-primary-500 bg-primary-500/30'
                      : 'border-[var(--ui-border)] bg-transparent'"
                  />
                </div>
                <p class="ml-auto text-xs text-dimmed tabular-nums">
                  {{ slot.total - slot.used }}<span class="opacity-50">/{{ slot.total }}</span>
                </p>
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-minus"
                    aria-label="Use slot"
                    :disabled="slot.used >= slot.total"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-plus"
                    aria-label="Restore slot"
                    :disabled="slot.used === 0"
                  />
                </div>
              </div>
            </div>

            <template #footer>
              <UButton size="xs" variant="solid" icon="i-lucide-sun">Long rest — restore all</UButton>
            </template>
          </UCard>

          <UCard class="self-start">
            <template #header>
              <h3 class="font-display text-base text-highlighted">Design notes</h3>
            </template>
            <ul class="space-y-2 text-sm leading-6 text-muted">
              <li class="flex gap-2">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                Show filled (remaining) dots as bright; empty (used) dots as muted outlines — not vice versa.
              </li>
              <li class="flex gap-2">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                Group levels vertically. Horizontal overflow on mobile should scroll, not wrap.
              </li>
              <li class="flex gap-2">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                Keep +/− buttons tiny and inline — this is a reference widget, not a primary action area.
              </li>
            </ul>
          </UCard>
        </div>
      </section>

      <!-- ── Threat Clocks ───────────────────────────────────────────── -->
      <section id="threat-clocks" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Threat Clocks</h2>
          <p class="text-sm text-muted">
            Segmented clocks for ticking threats. Urgency is communicated through color — not just segment count.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <UCard
            v-for="clock in dndThreatClocks"
            :key="clock.name"
            class="self-start"
          >
            <template #header>
              <div class="space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon
                      name="i-lucide-clock"
                      class="h-4 w-4 shrink-0"
                      :class="`text-${clock.urgency}-400`"
                    />
                    <h3 class="font-display text-sm text-highlighted">{{ clock.name }}</h3>
                  </div>
                  <p class="text-xs tabular-nums text-dimmed">{{ clock.filled }}/{{ clock.segments }}</p>
                </div>
                <p class="text-xs leading-5 text-muted">{{ clock.description }}</p>
              </div>
            </template>

            <div class="space-y-3">
              <!-- Segments -->
              <div class="flex gap-1.5">
                <div
                  v-for="i in clock.segments"
                  :key="i"
                  class="h-5 flex-1 rounded border-2 transition-all"
                  :class="i <= clock.filled
                    ? `${clockUrgencyBg(clock.urgency)} ${clockUrgencyBorder(clock.urgency)}`
                    : `border-2 bg-transparent ${clockUrgencyEmpty(clock.urgency)}`"
                />
              </div>

              <!-- Progress label -->
              <div class="h-1 w-full overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                <div
                  class="h-full rounded-full transition-all"
                  :class="clockUrgencyBg(clock.urgency)"
                  :style="{ width: `${(clock.filled / clock.segments) * 100}%` }"
                />
              </div>

              <!-- Consequence -->
              <div
                class="rounded-md border p-2.5 space-y-0.5"
                :class="`border-${clock.urgency}-500/30 bg-${clock.urgency}-500/5`"
              >
                <p class="text-[9px] uppercase tracking-[0.14em]" :class="`text-${clock.urgency}-400`">
                  When filled
                </p>
                <p class="text-xs leading-5 text-muted">{{ clock.consequence }}</p>
              </div>
            </div>

            <template #footer>
              <div class="flex gap-2">
                <UButton size="xs" :color="clock.urgency" variant="soft" icon="i-lucide-plus">Advance</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-minus">Undo</UButton>
              </div>
            </template>
          </UCard>
        </div>
      </section>

      <!-- ── Loot & Items ────────────────────────────────────────────── -->
      <section id="loot-items" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Loot &amp; Item Cards</h2>
          <p class="text-sm text-muted">
            Item rarity signals quality through color. Attunement and type metadata stay visible without crowding the description.
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <UCard
            v-for="item in dndItems"
            :key="item.name"
            class="self-start"
          >
            <template #header>
              <div class="space-y-1.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2.5">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      :class="`border-${rarityColor(item.rarity)}-500/40 bg-${rarityColor(item.rarity)}-500/10`"
                    >
                      <UIcon
                        :name="item.icon"
                        class="h-4 w-4"
                        :class="`text-${rarityColor(item.rarity)}-400`"
                      />
                    </div>
                    <div>
                      <h3 class="font-display text-sm text-highlighted leading-tight">{{ item.name }}</h3>
                      <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">{{ item.type }}</p>
                    </div>
                  </div>
                  <UBadge
                    :color="rarityColor(item.rarity)"
                    :variant="rarityVariant(item.rarity)"
                    :label="item.rarity"
                    size="xs"
                    class="shrink-0 capitalize"
                  />
                </div>

                <div class="flex gap-1.5">
                  <UBadge
                    v-if="item.requiresAttunement"
                    :color="item.isAttuned ? 'primary' : 'neutral'"
                    :variant="item.isAttuned ? 'soft' : 'outline'"
                    :label="item.isAttuned ? 'Attuned' : 'Requires attunement'"
                    :icon="item.isAttuned ? 'i-lucide-link' : 'i-lucide-link-2-off'"
                    size="xs"
                  />
                </div>
              </div>
            </template>

            <p class="text-sm leading-6 text-muted">{{ item.description }}</p>

            <template #footer>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" icon="i-lucide-book-open">Details</UButton>
                <UButton
                  v-if="item.requiresAttunement && !item.isAttuned"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-link"
                >
                  Attune
                </UButton>
              </div>
            </template>
          </UCard>
        </div>
      </section>

      <!-- ── Location Cards ─────────────────────────────────────────── -->
      <section id="location-cards" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Location Cards</h2>
          <p class="text-sm text-muted">
            Show discovery status, danger level, and connected quest hooks. Use status color to guide the DM's eye.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UCard
            v-for="loc in dndLocations"
            :key="loc.name"
            class="self-start"
          >
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5">
                  <UAvatar :icon="loc.icon" :alt="loc.name" size="sm" />
                  <div>
                    <h3 class="font-display text-base text-highlighted">{{ loc.name }}</h3>
                    <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">{{ loc.region }}</p>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <UBadge
                    :color="locationStatusColor(loc.status)"
                    variant="soft"
                    :label="loc.status"
                    size="xs"
                    class="capitalize"
                  />
                  <div class="flex items-center gap-1">
                    <UIcon name="i-lucide-flame" class="h-3 w-3" :class="`text-${dangerColor(loc.dangerLevel)}-400`" />
                    <p class="text-[10px] text-dimmed">{{ dangerLabel(loc.dangerLevel) }}</p>
                  </div>
                </div>
              </div>
            </template>

            <div class="space-y-3">
              <p class="text-sm leading-6 text-muted">{{ loc.description }}</p>

              <div v-if="loc.connectedQuests.length" class="space-y-1.5">
                <p class="text-[10px] uppercase tracking-[0.16em] text-dimmed">Connected Quests</p>
                <div class="flex flex-wrap gap-1.5">
                  <UBadge
                    v-for="quest in loc.connectedQuests"
                    :key="quest"
                    :label="quest"
                    color="primary"
                    variant="outline"
                    size="xs"
                    icon="i-lucide-scroll-text"
                  />
                </div>
              </div>
            </div>

            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" variant="outline" icon="i-lucide-map-pin">Open on map</UButton>
                <UButton size="xs" variant="ghost" icon="i-lucide-notebook-pen">Add note</UButton>
              </div>
            </template>
          </UCard>
        </div>
      </section>
      <!-- ── Session List ────────────────────────────────────────────── -->
      <section id="session-list" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Session List</h2>
          <p class="text-sm text-muted">
            Chronological session history. Surface recap and recording availability inline so the DM can orient quickly.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-display text-base text-highlighted">Emberfall: Bells Beneath the Archive</h3>
              <UBadge color="neutral" variant="outline" label="14 sessions" size="xs" />
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="session in dndSessions"
              :key="session.number"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              :class="session.status === 'upcoming' ? 'rounded-lg bg-primary-500/5 px-2 -mx-2' : ''"
            >
              <!-- Session number -->
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums"
                :class="session.status === 'upcoming'
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'bg-[var(--ui-bg-elevated)] text-dimmed'"
              >
                {{ session.number }}
              </div>

              <!-- Title + meta -->
              <div class="flex-1 min-w-0 space-y-0.5">
                <p class="truncate text-sm font-medium text-highlighted">{{ session.title }}</p>
                <div class="flex items-center gap-2 text-[10px] text-dimmed">
                  <span>{{ session.date }}</span>
                  <span>·</span>
                  <span>{{ session.playerCount }} players</span>
                </div>
              </div>

              <!-- Indicators -->
              <div class="flex items-center gap-1.5 shrink-0">
                <UIcon
                  name="i-lucide-scroll-text"
                  class="h-3.5 w-3.5 transition-colors"
                  :class="session.hasRecap ? 'text-success-400' : 'text-[var(--ui-border)]'"
                  title="Recap"
                />
                <UIcon
                  name="i-lucide-mic"
                  class="h-3.5 w-3.5 transition-colors"
                  :class="session.hasRecording ? 'text-info-400' : 'text-[var(--ui-border)]'"
                  title="Recording"
                />
              </div>

              <!-- Status badge -->
              <UBadge
                :color="sessionStatusColor(session.status)"
                variant="soft"
                :label="session.status"
                size="xs"
                class="shrink-0 capitalize"
              />

              <!-- Action -->
              <UButton size="xs" variant="ghost" icon="i-lucide-arrow-right" square aria-label="Open session" />
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between gap-2">
              <div class="flex gap-3 text-[10px] text-dimmed">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-scroll-text" class="h-3 w-3 text-success-400" /> Recap available
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-mic" class="h-3 w-3 text-info-400" /> Recording available
                </span>
              </div>
              <UButton size="xs" variant="ghost" icon="i-lucide-plus">New session</UButton>
            </div>
          </template>
        </UCard>
      </section>

      <!-- ── Quest List ──────────────────────────────────────────────── -->
      <section id="quest-list" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Quest List</h2>
          <p class="text-sm text-muted">
            Compact quest rows for campaign overviews and dashboards. Status and urgency communicate at a glance without opening each quest.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-display text-base text-highlighted">Active Campaign Quests</h3>
              <div class="flex gap-1.5">
                <UBadge color="success" variant="soft" label="2 active" size="xs" />
                <UBadge color="error" variant="soft" label="1 blocked" size="xs" />
              </div>
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="quest in dndQuestList"
              :key="quest.title"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <!-- Urgency indicator -->
              <UIcon
                :name="questUrgencyIcon(quest.urgency)"
                class="h-3.5 w-3.5 shrink-0"
                :class="`text-${questUrgencyColor(quest.urgency)}-400`"
              />

              <!-- Title + patron -->
              <div class="flex-1 min-w-0 space-y-0.5">
                <p
                  class="truncate text-sm font-medium"
                  :class="quest.status === 'complete' ? 'text-dimmed line-through' : 'text-highlighted'"
                >
                  {{ quest.title }}
                </p>
                <p class="text-[10px] text-dimmed">{{ quest.patron }}</p>
              </div>

              <!-- Updated -->
              <p class="shrink-0 text-[10px] text-dimmed tabular-nums hidden sm:block">{{ quest.updated }}</p>

              <!-- Status -->
              <UBadge
                :color="questStatusColor(quest.status)"
                variant="soft"
                :label="quest.status"
                size="xs"
                class="shrink-0 capitalize"
              />

              <!-- Action -->
              <UButton size="xs" variant="ghost" icon="i-lucide-arrow-right" square aria-label="Open quest" />
            </div>
          </div>

          <template #footer>
            <UButton size="xs" variant="ghost" icon="i-lucide-plus">Add quest</UButton>
          </template>
        </UCard>
      </section>

      <!-- ── NPC List ────────────────────────────────────────────────── -->
      <section id="npc-list" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">NPC List</h2>
          <p class="text-sm text-muted">
            Scannable NPC directory row. Show faction, last-seen session, and party relationship without opening the full profile.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-display text-base text-highlighted">Named Characters</h3>
              <UButton size="xs" variant="ghost" icon="i-lucide-search" square aria-label="Search NPCs" />
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="npc in dndNpcList"
              :key="npc.name"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <UAvatar :icon="npc.icon" :alt="npc.name" size="sm" />

              <div class="flex-1 min-w-0 space-y-0.5">
                <p class="truncate text-sm font-medium text-highlighted">{{ npc.name }}</p>
                <p class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ npc.faction }}</p>
              </div>

              <!-- Location -->
              <div class="hidden items-center gap-1 sm:flex shrink-0">
                <UIcon name="i-lucide-map-pin" class="h-3 w-3 text-dimmed" />
                <p class="text-xs text-dimmed">{{ npc.location }}</p>
              </div>

              <!-- Last seen -->
              <p class="shrink-0 text-[10px] text-dimmed hidden md:block">{{ npc.lastSeen }}</p>

              <!-- Relation -->
              <UBadge
                :color="npcRelationColor(npc.relation)"
                variant="soft"
                :label="npc.status"
                size="xs"
                class="shrink-0"
              />

              <div class="flex gap-1 shrink-0">
                <UButton size="xs" variant="ghost" icon="i-lucide-user" square aria-label="Open profile" />
                <UButton size="xs" variant="ghost" icon="i-lucide-notebook-pen" square aria-label="Add note" />
              </div>
            </div>
          </div>

          <template #footer>
            <UButton size="xs" variant="ghost" icon="i-lucide-plus">Add NPC</UButton>
          </template>
        </UCard>
      </section>

      <!-- ── Location List ───────────────────────────────────────────── -->
      <section id="location-list" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Location List</h2>
          <p class="text-sm text-muted">
            Compact location rows for the map index or sidebar. Discovery status and danger level stay visible without opening the full location view.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-display text-base text-highlighted">Known Locations</h3>
              <UButton size="xs" variant="ghost" icon="i-lucide-map" square aria-label="Open map" />
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="loc in dndLocations"
              :key="loc.name"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <!-- Icon -->
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--ui-bg-elevated)]">
                <UIcon :name="loc.icon" class="h-3.5 w-3.5 text-muted" />
              </div>

              <!-- Name + region -->
              <div class="flex-1 min-w-0 space-y-0.5">
                <p class="truncate text-sm font-medium text-highlighted">{{ loc.name }}</p>
                <p class="text-[10px] text-dimmed">{{ loc.region }}</p>
              </div>

              <!-- Quest count -->
              <div class="hidden items-center gap-1 sm:flex shrink-0">
                <UIcon name="i-lucide-scroll-text" class="h-3 w-3 text-dimmed" />
                <p class="text-[10px] text-dimmed">{{ loc.connectedQuests.length }} quest{{ loc.connectedQuests.length !== 1 ? 's' : '' }}</p>
              </div>

              <!-- Danger -->
              <div class="hidden items-center gap-1 md:flex shrink-0">
                <UIcon name="i-lucide-flame" class="h-3 w-3" :class="`text-${dangerColor(loc.dangerLevel)}-400`" />
                <p class="text-[10px] text-dimmed">{{ dangerLabel(loc.dangerLevel) }}</p>
              </div>

              <!-- Status -->
              <UBadge
                :color="locationStatusColor(loc.status)"
                variant="soft"
                :label="loc.status"
                size="xs"
                class="shrink-0 capitalize"
              />

              <UButton size="xs" variant="ghost" icon="i-lucide-arrow-right" square aria-label="Open location" />
            </div>
          </div>

          <template #footer>
            <UButton size="xs" variant="ghost" icon="i-lucide-plus">Add location</UButton>
          </template>
        </UCard>
      </section>

      <!-- ── Milestones ──────────────────────────────────────────────── -->
      <section id="milestones" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Milestones</h2>
          <p class="text-sm text-muted">
            Campaign-level story beats and goals. Use a timeline layout to show progress through arcs at a glance.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-display text-base text-highlighted">Campaign Progress</h3>
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                  <div
                    class="h-full rounded-full bg-success-500"
                    :style="{
                      width: `${(dndMilestones.filter(m => m.complete).length / dndMilestones.length) * 100}%`
                    }"
                  />
                </div>
                <p class="text-[10px] text-dimmed">
                  {{ dndMilestones.filter(m => m.complete).length }}/{{ dndMilestones.length }}
                </p>
              </div>
            </div>
          </template>

          <div class="relative space-y-0">
            <!-- Vertical track line -->
            <div class="absolute left-[13px] top-2 bottom-2 w-px bg-[var(--ui-border)]" />

            <div
              v-for="(milestone, idx) in dndMilestones"
              :key="milestone.title"
              class="relative flex gap-4 pb-5 last:pb-0"
            >
              <!-- Dot on the track -->
              <div class="relative z-10 shrink-0 mt-0.5">
                <div
                  class="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors"
                  :class="milestone.complete
                    ? 'border-success-500 bg-success-500/20'
                    : 'border-[var(--ui-border)] bg-[var(--ui-bg)]'"
                >
                  <UIcon
                    v-if="milestone.complete"
                    name="i-lucide-check"
                    class="h-3 w-3 text-success-400"
                  />
                  <div
                    v-else
                    class="h-1.5 w-1.5 rounded-full"
                    :class="idx === dndMilestones.findIndex(m => !m.complete) ? 'bg-primary-400' : 'bg-[var(--ui-border)]'"
                  />
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-start justify-between gap-2">
                  <p
                    class="text-sm font-medium leading-tight"
                    :class="milestone.complete ? 'text-muted' : 'text-highlighted'"
                  >
                    {{ milestone.title }}
                  </p>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <UBadge color="neutral" variant="outline" :label="milestone.session" size="xs" />
                  </div>
                </div>
                <p class="text-xs leading-5 text-dimmed">{{ milestone.description }}</p>
                <p class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ milestone.arc }}</p>
              </div>
            </div>
          </div>

          <template #footer>
            <UButton size="xs" variant="ghost" icon="i-lucide-plus">Add milestone</UButton>
          </template>
        </UCard>
      </section>

      <!-- ── Audio Playlist ──────────────────────────────────────────── -->
      <section id="audio-playlist" class="scroll-mt-28 space-y-4">
        <div class="space-y-1">
          <h2 class="font-display text-xl tracking-[0.03em] text-highlighted">Recap Audio Playlist</h2>
          <p class="text-sm text-muted">
            Session recording list with inline play state. Keep duration and size visible for quick reference before download.
          </p>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-disc-3" class="h-4 w-4 text-primary-400" />
                <h3 class="font-display text-base text-highlighted">Session Recordings</h3>
              </div>
              <UBadge color="neutral" variant="outline" :label="`${dndAudioTracks.length} recordings`" size="xs" />
            </div>
          </template>

          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="(track, idx) in dndAudioTracks"
              :key="track.session"
              class="py-3 first:pt-0 last:pb-0"
            >
              <div class="flex items-center gap-3">
                <!-- Play / pause button -->
                <button
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                  :class="activeTrackIndex === idx
                    ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                    : 'border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] text-muted hover:border-primary-500/60 hover:text-primary-400'"
                  @click="toggleTrack(idx)"
                  :aria-label="activeTrackIndex === idx ? 'Pause' : 'Play'"
                >
                  <UIcon
                    :name="activeTrackIndex === idx ? 'i-lucide-pause' : 'i-lucide-play'"
                    class="h-3.5 w-3.5 ml-0.5"
                    :class="activeTrackIndex === idx ? '' : 'ml-0.5'"
                  />
                </button>

                <!-- Track info -->
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="flex items-center gap-2">
                    <p class="truncate text-sm font-medium text-highlighted">{{ track.title }}</p>
                    <UBadge color="neutral" variant="outline" :label="`S${track.session}`" size="xs" class="shrink-0" />
                  </div>

                  <!-- Waveform placeholder / progress bar -->
                  <div class="h-5 overflow-hidden rounded flex items-center gap-px">
                    <div
                      v-for="i in 48"
                      :key="i"
                      class="w-px shrink-0 rounded-sm transition-colors"
                      :style="{ height: `${20 + Math.abs(Math.sin(i * 0.7 + track.session) * 14)}px` }"
                      :class="activeTrackIndex === idx && i < 18
                        ? 'bg-primary-400'
                        : 'bg-[var(--ui-border)]'"
                    />
                  </div>
                </div>

                <!-- Meta -->
                <div class="hidden flex-col items-end gap-0.5 sm:flex shrink-0">
                  <p class="text-xs text-muted tabular-nums">{{ track.duration }}</p>
                  <p class="text-[10px] text-dimmed">{{ track.date }} · {{ track.fileSize }}</p>
                </div>

                <!-- Download -->
                <UButton size="xs" variant="ghost" icon="i-lucide-download" square aria-label="Download recording" />
              </div>

              <!-- Expanded player state -->
              <div v-if="activeTrackIndex === idx" class="mt-3 space-y-2 pl-11">
                <div class="flex items-center gap-2">
                  <p class="text-[10px] text-dimmed tabular-nums">0:00</p>
                  <div class="flex-1 h-1 rounded-full bg-[var(--ui-bg-elevated)] overflow-hidden">
                    <div class="h-full w-1/3 rounded-full bg-primary-500" />
                  </div>
                  <p class="text-[10px] text-dimmed tabular-nums">{{ track.duration }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <UButton size="xs" variant="ghost" icon="i-lucide-skip-back" square />
                  <UButton size="xs" variant="ghost" icon="i-lucide-rewind" square />
                  <UButton size="xs" :color="'primary'" variant="soft" icon="i-lucide-pause">Playing</UButton>
                  <UButton size="xs" variant="ghost" icon="i-lucide-fast-forward" square />
                  <UButton size="xs" variant="ghost" icon="i-lucide-skip-forward" square />
                  <span class="ml-auto text-[10px] text-dimmed">1× speed</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </section>

    </UPageBody>

    <template #right>
      <UPageAside>
        <UCard>
          <template #header>
            <h3 class="font-display text-xs uppercase tracking-[0.1em] text-dimmed">
              On This Page
            </h3>
          </template>
          <UNavigationMenu :items="tocLinks" orientation="vertical" />
        </UCard>
      </UPageAside>
    </template>
  </UPage>
</template>
