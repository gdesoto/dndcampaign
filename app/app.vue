<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div id="global-media-player-host" class="hidden"/>
    <ClientOnly>
      <GlobalMediaPlayer />
    </ClientOnly>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

