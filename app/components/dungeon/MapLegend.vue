<script setup lang="ts">
import type { DungeonMapData } from '#shared/types/dungeon'
import { getDungeonFloorMap } from '#shared/utils/dungeon-map'
import { renderDungeonLegend } from '#shared/utils/dungeon-render'
import { dungeonMarkerColors } from '~/utils/dungeon-map-features'

const props = defineProps<{
  map: DungeonMapData
  floor: number
  showRoute?: boolean
}>()

// Map symbols come from the renderer; content markers are the canvas's own dots.
const sections = computed(() => {
  const floorMap = getDungeonFloorMap(props.map, props.floor)
  const markers = [
    { key: 'trap', label: 'Trap', color: dungeonMarkerColors.trap, present: floorMap.traps.length > 0 },
    { key: 'encounter', label: 'Encounter', color: dungeonMarkerColors.encounter, present: floorMap.encounters.length > 0 },
    { key: 'treasure', label: 'Treasure', color: dungeonMarkerColors.treasure, present: floorMap.treasures.length > 0 },
  ].filter(marker => marker.present)
  return [
    ...renderDungeonLegend(props.map, { floor: props.floor, includeFlow: props.showRoute }),
    ...(markers.length ? [{ title: 'Contents', items: markers.map(marker => ({
      key: marker.key,
      label: marker.label,
      viewBox: '0 0 32 32',
      content: `<circle cx="16" cy="16" r="7" fill="${marker.color}" stroke="#2b2116" stroke-width="2" />`,
    })) }] : []),
  ]
})
</script>

<template>
  <div class="grid w-72 max-w-[calc(100vw-2rem)] gap-3 p-3 text-xs">
    <section v-for="section in sections" :key="section.title" class="space-y-1.5">
      <h3 class="type-label text-highlighted">{{ section.title }}</h3>
      <ul class="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <li v-for="item in section.items" :key="item.key" class="flex min-w-0 items-center gap-2 text-muted">
          <!-- Renderer and marker markup is fixed; every attribute and text value is escaped. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <svg :viewBox="item.viewBox" class="h-6 w-9 shrink-0" preserveAspectRatio="xMidYMid meet" aria-hidden="true" v-html="item.content" />
          <span class="min-w-0">{{ item.label }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
