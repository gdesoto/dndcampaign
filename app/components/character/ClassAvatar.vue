<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  src?: string
  classes?: string[]
  level?: number
}>(), { src: undefined, classes: () => [], level: undefined })

// Class identity uses a fixed dark palette so white initials work in either theme.
// For multiclass characters, use the first recognized class in sheet order.
const gradients = {
  artificer: 'from-amber-800 to-slate-800',
  barbarian: 'from-red-800 to-orange-950',
  bard: 'from-fuchsia-800 to-violet-950',
  cleric: 'from-amber-800 to-yellow-950',
  druid: 'from-green-800 to-emerald-950',
  fighter: 'from-stone-700 to-red-950',
  monk: 'from-orange-800 to-stone-900',
  paladin: 'from-blue-800 to-amber-950',
  ranger: 'from-emerald-800 to-stone-900',
  rogue: 'from-slate-700 to-indigo-950',
  sorcerer: 'from-rose-800 to-purple-950',
  warlock: 'from-purple-800 to-slate-950',
  wizard: 'from-blue-800 to-indigo-950',
} as const
const gradient = computed(() => {
  for (const entry of props.classes) {
    const key = entry.trim().toLowerCase().match(/^[a-z]+/)?.[0]
    if (key && key in gradients) return gradients[key as keyof typeof gradients]
  }
  return 'from-stone-600 to-slate-800'
})
const initials = computed(() => props.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join(''))
</script>

<template>
  <span class="relative inline-flex shrink-0" :class="level ? 'mb-1 mr-1' : ''">
    <UAvatar :src="src" :alt="name" size="xl" class="border border-accented">
      <span class="flex size-full items-center justify-center rounded-full bg-linear-to-br font-display font-semibold text-white" :class="gradient">{{ initials }}</span>
    </UAvatar>
    <span v-if="level" :aria-label="`Level ${level}`" class="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-elevated bg-primary-500 font-display text-xs font-bold tabular-nums text-neutral-950">{{ level }}</span>
  </span>
</template>
