<script setup lang="ts">
// The active identity is applied here, once, in the three layers section 9 of
// the guidelines names: runtime color aliases, CSS tokens on <html>, and shared
// component defaults through the native UTheme. No page or component below
// knows which identity is running.
const { identity, STORAGE_KEY } = useIdentity();
watch(
  identity,
  (value, previous) => {
    updateAppConfig({ ui: { colors: value.colors } });
    if (!import.meta.client) return;
    // The token class is written directly rather than through htmlAttrs so it
    // cannot race the color-mode class on the same element.
    if (previous) document.documentElement.classList.remove(previous.className);
    document.documentElement.classList.add(value.className);
    localStorage.setItem(STORAGE_KEY, value.id);
  },
  { immediate: true },
);
useHead({ titleTemplate: "%s · Fieldwork", htmlAttrs: { lang: "en" } });
const mobile = ref(false);
let stopMedia: (() => void) | undefined;
onMounted(() => {
  const media = window.matchMedia('(max-width: 767px)');
  const update = () => { mobile.value = media.matches; };
  update();
  media.addEventListener('change', update);
  stopMedia = () => media.removeEventListener('change', update);
});
onUnmounted(() => stopMedia?.());
</script>
<template>
  <UApp :toaster="{ position: mobile ? 'bottom-center' : 'bottom-right', max: 3, duration: 4000, ui: { viewport: 'app-toast-viewport' } }"
    ><UTheme
:ui="identity.ui"
:props="identity.props"
      ><NuxtLayout><NuxtPage /></NuxtLayout></UTheme
  ></UApp>
</template>
