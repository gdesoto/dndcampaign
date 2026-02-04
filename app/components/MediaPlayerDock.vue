<script setup lang="ts">
const props = withDefaults(
  defineProps<{ dockId?: string; mode?: 'page' | 'global' }>(),
  {
    dockId: 'media-player-dock',
    mode: 'page',
  }
)

const player = useMediaPlayer()
const resolvedId = computed(() => props.dockId || 'media-player-dock')

onMounted(() => {
  player.setDockId(resolvedId.value)
  if (props.mode === 'page') {
    player.setPresentation('page')
  }
})

onBeforeRouteLeave(() => {
  if (props.mode === 'page') {
    player.setPresentation('global')
  }
})

onBeforeUnmount(() => {
  if (player.state.value.dockId === resolvedId.value) {
    player.setDockId('')
  }
  if (props.mode === 'page' && player.state.value.presentation === 'page') {
    player.setPresentation('global')
  }
})
</script>

<template>
  <div :id="resolvedId" class="space-y-3" />
</template>
