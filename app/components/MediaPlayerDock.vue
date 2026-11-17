<script setup lang="ts">
const props = withDefaults(
  defineProps<{ sourceId?: string; dockId?: string; mode?: 'page' | 'global' }>(),
  {
    sourceId: '',
    dockId: 'media-player-dock',
    mode: 'page',
  }
)

const player = useMediaPlayer()
const resolvedId = computed(() => props.dockId || 'media-player-dock')

// Mounting an unrelated editor must not pull the active listening session into it.
const updatePresentation = () => {
  const expected = props.sourceId
  const current = player.state.value.source?.id
  if (props.mode !== 'page') return
  if (expected && expected === current) player.setPresentation('page')
  else if (current && player.state.value.dockId === resolvedId.value) player.setPresentation('global')
}

onMounted(() => {
  player.setDockId(resolvedId.value)
  updatePresentation()
})

watch([() => props.sourceId, () => player.state.value.source?.id], updatePresentation)

onBeforeRouteLeave(() => {
  if (props.mode === 'page') {
    player.setPresentation('global')
  }
})

onBeforeUnmount(() => {
  if (player.state.value.dockId !== resolvedId.value) return
  player.setDockId('')
  if (props.mode === 'page' && player.state.value.presentation === 'page') {
    player.setPresentation('global')
  }
})
</script>

<template>
  <div :id="resolvedId" class="space-y-3" />
</template>
