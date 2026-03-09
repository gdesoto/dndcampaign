<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise" />
    <div class="theme-overlay theme-overlay-pattern" />

    <div class="relative z-10 flex min-h-screen flex-col">
      <AppHeader />
      <div class="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <slot />
      </div>
      <AppFooter />
    </div>
  </div>
</template>
