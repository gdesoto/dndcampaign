import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  ssr: false,
  modules: ["@nuxt/ui", "@nuxt/eslint"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-06-30",
  devtools: { enabled: false },
  ui: { fonts: true },
  // Scan source for icon names so every referenced icon ships in the client
  // bundle. Without this only Nuxt UI's own icons are bundled and the rest are
  // fetched from the public Iconify API at runtime.
  icon: { clientBundle: { scan: true } },
  // The guide page imports the skill's canonical reference outside the app.
  vite: { server: { fs: { allow: [
    fileURLToPath(new URL(".", import.meta.url)),
    fileURLToPath(new URL("../../references/guidelines.md", import.meta.url)),
  ] } } },
  eslint: { config: { stylistic: false } },
});
