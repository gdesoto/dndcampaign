<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div id="global-media-player-host" class="hidden"></div>
    <ClientOnly>
      <GlobalMediaPlayer />
    </ClientOnly>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

