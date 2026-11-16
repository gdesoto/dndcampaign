<script setup lang="ts">
type SlotField = 'max' | 'remaining'
type ListKey = 'prepared' | 'known'

// Spells are free-form JSON; unknown keys and fields must survive every edit.
const spells = defineModel<Record<string, unknown>>({ required: true })

const id = useId()
const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const lists: Array<{ key: ListKey; label: string }> = [{ key: 'prepared', label: 'Prepared' }, { key: 'known', label: 'Known' }]
const newNames = reactive<Record<ListKey, string>>({ prepared: '', known: '' })

const slots = computed(() => {
  const value = spells.value.slots
  return (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
})

const slotValue = (level: number, field: SlotField): number => {
  const slot = slots.value[level]
  if (typeof slot === 'number') return slot
  const value = (slot as Record<string, unknown> | undefined)?.[field]
  if (typeof value === 'number') return value
  return field === 'remaining' ? slotValue(level, 'max') : 0
}

const setSlot = (level: number, field: SlotField, value: number | null | undefined) => {
  const current = slots.value[level]
  const max = field === 'max' ? value ?? 0 : slotValue(level, 'max')
  // A newly added level starts with every slot available.
  const remaining = Math.min(field === 'remaining' ? value ?? 0 : current === undefined ? max : slotValue(level, 'remaining'), max)
  const { [level]: _, ...next } = slots.value
  if (max > 0) next[level] = { ...(typeof current === 'object' ? current : {}), max, remaining }
  const { slots: __, ...rest } = spells.value
  spells.value = Object.keys(next).length ? { ...rest, slots: next } : rest
}

const listOf = (key: ListKey) => (Array.isArray(spells.value[key]) ? spells.value[key] : []) as unknown[]
const spellName = (spell: unknown) => spell && typeof spell === 'object' ? String((spell as Record<string, unknown>).name ?? '') : String(spell)
const setList = (key: ListKey, list: unknown[]) => { spells.value = { ...spells.value, [key]: list } }

const addSpell = (key: ListKey) => {
  const name = newNames[key].trim()
  if (!name || listOf(key).some(spell => spellName(spell).toLowerCase() === name.toLowerCase())) return
  setList(key, [...listOf(key), name])
  newNames[key] = ''
}

const renameSpell = (key: ListKey, index: number, name: string) => setList(key, listOf(key).map((spell, i) => {
  if (i !== index) return spell
  return spell && typeof spell === 'object' ? { ...spell, name } : name
}))

const removeSpell = (key: ListKey, index: number) => setList(key, listOf(key).filter((_, i) => i !== index))
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <p class="type-label">Spell Slots</p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <fieldset v-for="level in levels" :key="level" class="sheet-compartment space-y-1.5 p-2">
          <legend class="sr-only">Level {{ level }} slots</legend>
          <p class="type-label" aria-hidden="true">Lv {{ level }}</p>
          <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
            <div>
              <label class="mb-0.5 block text-xs text-muted" :for="`${id}-${level}-max`">Max</label>
              <UInputNumber
                :id="`${id}-${level}-max`"
                :model-value="slotValue(level, 'max')"
                :min="0"
                size="sm"
                @update:model-value="setSlot(level, 'max', $event)"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-xs text-muted" :for="`${id}-${level}-remaining`">Remaining</label>
              <UInputNumber
                :id="`${id}-${level}-remaining`"
                :model-value="slotValue(level, 'remaining')"
                :min="0"
                :max="slotValue(level, 'max')"
                :disabled="!slotValue(level, 'max')"
                size="sm"
                @update:model-value="setSlot(level, 'remaining', $event)"
              />
            </div>
          </div>
        </fieldset>
      </div>
    </div>

    <div v-for="list in lists" :key="list.key" class="space-y-2">
      <p :id="`${id}-${list.key}`" class="type-label">{{ list.label }}</p>
      <ul v-if="listOf(list.key).length" class="space-y-1.5" :aria-labelledby="`${id}-${list.key}`">
        <li v-for="(spell, index) in listOf(list.key)" :key="index" class="flex items-center gap-1.5">
          <UInput
            :model-value="spellName(spell)"
            :aria-label="`${list.label} spell ${index + 1}`"
            size="sm"
            class="min-w-0 flex-1"
            @update:model-value="renameSpell(list.key, index, String($event))"
          />
          <UTooltip text="Remove">
            <UButton
              icon="i-lucide-x"
              size="sm"
              color="neutral"
              variant="ghost"
              :aria-label="`Remove ${spellName(spell) || 'spell'}`"
              @click="removeSpell(list.key, index)"
            />
          </UTooltip>
        </li>
      </ul>
      <form class="flex items-center gap-1.5" @submit.prevent="addSpell(list.key)">
        <UInput
          v-model="newNames[list.key]"
          :aria-label="`New ${list.label.toLowerCase()} spell`"
          placeholder="Spell name"
          size="sm"
          class="min-w-0 flex-1"
        />
        <UButton type="submit" icon="i-lucide-plus" size="sm" variant="outline" :disabled="!newNames[list.key].trim()">
          Add
        </UButton>
      </form>
    </div>
  </div>
</template>
