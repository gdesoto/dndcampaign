<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div id="global-media-player-host" class="hidden" />
    <ClientOnly>
      <GlobalMediaPlayer />
    </ClientOnly>
    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>
  </UApp>
</template>
