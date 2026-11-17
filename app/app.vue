<template>
  <UApp>
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <div id="global-media-player-host" class="hidden" />
    <ClientOnly>
      <GlobalMediaPlayer />
      <SharedPwaStatus />
    </ClientOnly>
    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>
  </UApp>
</template>
