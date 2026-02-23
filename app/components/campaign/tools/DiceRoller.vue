<script setup lang="ts">
import { rollDiceExpression, type RollResult, type RolledTerm } from '~/utils/dice'

type DiceHistoryItem = {
  id: string
  label: string
  result: RollResult
  rolledAt: string
  mode: 'notation' | 'd20'
  reroll: {
    kind: 'notation' | 'advantage' | 'disadvantage'
    expression: string
  }
}

const notation = ref('1d20')
const notationError = ref('')
const latestResult = ref<DiceHistoryItem | null>(null)
const history = ref<DiceHistoryItem[]>([])
const toast = useToast()
const builderCount = ref(1)
const builderSides = ref(20)
const builderModifier = ref(0)
const builderMode = ref<'normal' | 'advantage' | 'disadvantage'>('normal')
const advancedOpen = ref(false)

const presetNotations = [
  '1d4',
  '1d6',
  '1d8',
  '1d10',
  '1d12',
  '1d20',
  '2d6',
  '4d6',
]

const maxHistory = 20
const dieTypeOptions = [
  { label: 'd4', value: 4 },
  { label: 'd6', value: 6 },
  { label: 'd8', value: 8 },
  { label: 'd10', value: 10 },
  { label: 'd12', value: 12 },
  { label: 'd20', value: 20 },
  { label: 'd100', value: 100 },
]

const toHistoryItem = (
  label: string,
  result: RollResult,
  mode: DiceHistoryItem['mode'],
  reroll: DiceHistoryItem['reroll'],
) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  label,
  result,
  rolledAt: new Date().toISOString(),
  mode,
  reroll,
})

const pushHistory = (item: DiceHistoryItem) => {
  latestResult.value = item
  history.value = [item, ...history.value].slice(0, maxHistory)
  toast.add({
    title: `Rolled ${item.result.total}`,
    description: item.label,
    icon: 'i-lucide-dice-5',
    color: 'primary',
  })
}

const rollNotation = (value = notation.value) => {
  notationError.value = ''
  try {
    const result = rollDiceExpression(value)
    pushHistory(
      toHistoryItem(value, result, 'notation', {
        kind: 'notation',
        expression: value,
      }),
    )
    notation.value = value
  } catch (error) {
    notationError.value = (error as Error).message || 'Unable to roll notation.'
  }
}

const formatSigned = (value: number) => (value >= 0 ? `+${value}` : String(value))
const formatModifierSuffix = (value: number) => (value === 0 ? '' : formatSigned(value))
const builderExpression = computed(
  () => `${builderCount.value}d${builderSides.value}${formatModifierSuffix(builderModifier.value)}`
)
const builderModifierLabel = computed(() => formatSigned(builderModifier.value))

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const incrementBuilderCount = () => {
  builderCount.value = clamp(builderCount.value + 1, 1, 100)
}

const decrementBuilderCount = () => {
  builderCount.value = clamp(builderCount.value - 1, 1, 100)
}

const incrementBuilderModifier = () => {
  builderModifier.value = clamp(builderModifier.value + 1, -99, 99)
}

const decrementBuilderModifier = () => {
  builderModifier.value = clamp(builderModifier.value - 1, -99, 99)
}

const rollWithMode = (expression: string, mode: 'normal' | 'advantage' | 'disadvantage') => {
  if (mode === 'normal') {
    rollNotation(expression)
    return
  }
  const first = rollDiceExpression(expression)
  const second = rollDiceExpression(expression)
  const firstValue = first.total
  const secondValue = second.total
  const selected =
    mode === 'advantage'
      ? firstValue >= secondValue
        ? first
        : second
      : firstValue <= secondValue
        ? first
        : second

  pushHistory(
    toHistoryItem(
      `${expression} ${mode} [${firstValue}, ${secondValue}]`,
      {
        ...selected,
        notation: `${expression} (${mode})`,
      },
      'notation',
      {
        kind: mode,
        expression,
      },
    ),
  )
}

const rollFromBuilder = () => {
  notationError.value = ''
  const count = Math.min(Math.max(Math.floor(builderCount.value || 1), 1), 100)
  builderCount.value = count
  const expression = `${count}d${builderSides.value}${formatModifierSuffix(builderModifier.value)}`
  rollWithMode(expression, builderMode.value)
}

const rerollHistoryItem = (item: DiceHistoryItem) => {
  notationError.value = ''
  rollWithMode(item.reroll.expression, item.reroll.kind === 'notation' ? 'normal' : item.reroll.kind)
}

const formatTerm = (term: RolledTerm) => {
  if (term.kind === 'flat') return `${term.sign === -1 ? '-' : '+'}${term.value}`
  const sign = term.sign === -1 ? '-' : '+'
  return `${sign}${term.count}d${term.sides} (${term.rolls.join(', ')})`
}

const clearHistory = () => {
  history.value = []
  latestResult.value = null
  notationError.value = ''
}

const resetBuilder = () => {
  builderCount.value = 1
  builderSides.value = 20
  builderModifier.value = 0
  builderMode.value = 'normal'
  notationError.value = ''
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
    <UCard :ui="{ body: 'p-5 md:p-6' }">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
        <div class="space-y-5">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-dimmed">Dice Roller</p>
            <h2 class="mt-1 text-xl font-semibold">Roll checks and damage quickly</h2>
            <h3 class="mt-2 text-muted">Build a Roll</h3>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <p class="text-sm text-muted">How many dice</p>
              <div class="flex items-center gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-minus"
                  aria-label="Decrease dice count"
                  @click="decrementBuilderCount"
                />
                <div class="min-w-20 rounded-md border border-default px-4 py-2 text-center font-medium">
                  {{ builderCount }}
                </div>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-plus"
                  aria-label="Increase dice count"
                  @click="incrementBuilderCount"
                />
              </div>
            </div>
            <div class="space-y-2">
              <p class="text-sm text-muted">Modifier</p>
              <div class="flex items-center gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-minus"
                  aria-label="Decrease roll modifier"
                  @click="decrementBuilderModifier"
                />
                <div class="min-w-20 rounded-md border border-default px-4 py-2 text-center font-medium">
                  {{ builderModifierLabel }}
                </div>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-plus"
                  aria-label="Increase roll modifier"
                  @click="incrementBuilderModifier"
                />
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-sm text-muted">Die type</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="die in dieTypeOptions"
                :key="die.value"
                :color="builderSides === die.value ? 'primary' : 'neutral'"
                :variant="builderSides === die.value ? 'solid' : 'outline'"
                size="lg"
                @click="builderSides = die.value"
              >
                {{ die.label }}
              </UButton>
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-sm text-muted">Roll mode</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                :color="builderMode === 'normal' ? 'primary' : 'neutral'"
                :variant="builderMode === 'normal' ? 'solid' : 'outline'"
                size="lg"
                @click="builderMode = 'normal'"
              >
                Normal
              </UButton>
              <UButton
                :color="builderMode === 'advantage' ? 'primary' : 'neutral'"
                :variant="builderMode === 'advantage' ? 'solid' : 'outline'"
                size="lg"
                @click="builderMode = 'advantage'"
              >
                Advantage
              </UButton>
              <UButton
                :color="builderMode === 'disadvantage' ? 'primary' : 'neutral'"
                :variant="builderMode === 'disadvantage' ? 'solid' : 'outline'"
                size="lg"
                @click="builderMode = 'disadvantage'"
              >
                Disadvantage
              </UButton>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="lg" icon="i-lucide-dice-5" @click="rollFromBuilder">Roll {{ builderExpression }}</UButton>
            <UButton size="lg" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="resetBuilder">
              Reset
            </UButton>
            <UBadge color="neutral" variant="subtle">Expression: {{ builderExpression }}</UBadge>
          </div>
          <div class="space-y-3">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="advancedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="advancedOpen = !advancedOpen"
            >
              {{ advancedOpen ? 'Hide advanced notation' : 'Advanced: type notation' }}
            </UButton>
            <div v-if="advancedOpen" class="space-y-2 rounded-md border border-default p-3">
              <UFormField label="Notation expression" name="notation" help="Examples: d20+5, 2d6+3, 4d8-2">
                <UInput
                  v-model="notation"
                  placeholder="e.g. 2d6+3"
                  @keydown.enter.prevent="rollNotation()"
                />
              </UFormField>
              <UButton color="neutral" variant="outline" @click="rollNotation()">Roll notation</UButton>
            </div>
            <UAlert
              v-if="notationError"
              color="error"
              variant="subtle"
              title="Invalid notation"
              :description="notationError"
            />
          </div>
        </div>

        <div class="space-y-2 lg:sticky lg:top-6">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quick Roll</p>
          <div class="flex flex-col gap-2">
            <UButton
              v-for="preset in presetNotations"
              :key="preset"
              color="neutral"
              variant="outline"
              size="sm"
              class="w-full justify-center"
              @click="rollNotation(preset)"
            >
              Roll {{ preset }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UCard :ui="{ body: 'p-4' }">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">History</p>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-trash-2"
              :disabled="!history.length"
              @click="clearHistory"
            >
              Clear
            </UButton>
          </div>
        </template>
        <div v-if="history.length" class="space-y-2">
          <UCard
            v-for="item in history"
            :key="item.id"
            :ui="{ body: 'p-3' }"
          >
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <p
                    v-if="item.id === history[0]?.id"
                    class="text-xs uppercase tracking-[0.2em] text-dimmed"
                  >
                    Latest roll
                  </p>
                  <p class="truncate text-sm font-medium">{{ item.label }}</p>
                  <p class="text-xs text-muted">
                    {{ new Date(item.rolledAt).toLocaleTimeString() }} • {{ item.result.notation }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge
                    color="primary"
                    :variant="item.id === history[0]?.id ? 'solid' : 'subtle'"
                    :size="item.id === history[0]?.id ? 'lg' : 'md'"
                  >
                    Total {{ item.result.total }}
                  </UBadge>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-redo-2"
                    @click="rerollHistoryItem(item)"
                  >
                    Reroll
                  </UButton>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="(term, index) in item.result.terms"
                  :key="`${item.id}-term-${index}`"
                  color="neutral"
                  variant="subtle"
                >
                  {{ formatTerm(term) }} = {{ term.subtotal }}
                </UBadge>
              </div>
            </div>
          </UCard>
        </div>
        <p v-else class="text-sm text-muted">No rolls yet. Build a roll to get started.</p>
    </UCard>
  </div>
</template>
