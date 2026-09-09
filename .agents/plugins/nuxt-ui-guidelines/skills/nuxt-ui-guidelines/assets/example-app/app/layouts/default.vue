<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
const open = ref(false);
const route = useRoute();
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);
const { requestRows } = useAcademics();
const { identities, active, select } = useIdentity();
const identityItems = computed(() =>
  identities.map((item) => ({ label: item.label, value: item.id, icon: item.icon })),
);
const identityMenu = computed(() =>
  identities.map((item) => ({
    label: item.label,
    icon: item.icon,
    type: "checkbox" as const,
    checked: item.id === active.value,
    onSelect: () => select(item.id),
  })),
);
// Appearance is an icon-only menu rather than a toggle so that System stays a
// choice; it renders client-side only, because the resolved mode is unknown
// during server rendering and `system` is the value that exposes the mismatch.
const colorMode = useColorMode();
const appearances = [
  { label: "System", value: "system", icon: "i-lucide-monitor" },
  { label: "Light", value: "light", icon: "i-lucide-sun" },
  { label: "Dark", value: "dark", icon: "i-lucide-moon" },
];
const appearanceIcon = computed(
  () =>
    appearances.find((item) => item.value === colorMode.preference)?.icon
    || "i-lucide-monitor",
);
const appearanceMenu = computed(() =>
  appearances.map((item) => ({
    label: item.label,
    icon: item.icon,
    type: "checkbox" as const,
    checked: colorMode.preference === item.value,
    onSelect: () => {
      colorMode.preference = item.value;
    },
  })),
);
const toast = useToast();
const user = { name: "Alex Morgan", email: "alex.morgan@example.edu" };
const accountMenu = computed(() => [
  [{ label: user.email, type: "label" as const }],
  [
    { label: "Profile and settings", icon: "i-lucide-settings", to: "/settings" },
    { label: "Guidelines", icon: "i-lucide-book-open", to: "/guide" },
    { label: "Component gallery", icon: "i-lucide-panels-top-left", to: "/gallery/components" },
  ],
  [
    {
      label: "Sign out",
      icon: "i-lucide-log-out",
      onSelect: () =>
        toast.add({
          title: "This example has no account to sign out of.",
          color: "info",
        }),
    },
  ],
]);
const items = computed<NavigationMenuItem[][]>(() => [
  [
    { label: "Examples", type: "label" },
    { label: "Courses", icon: "i-lucide-graduation-cap", type: 'trigger', active: route.path.startsWith('/courses'), defaultOpen: true, children: [
      { label: 'Catalog', icon: 'i-lucide-library', to: '/courses', exact: true },
      { label: 'Sections', icon: 'i-lucide-layers', to: '/courses/sections' },
      { label: 'Requests', icon: 'i-lucide-inbox', to: '/courses/requests', badge: requestRows.value.length || undefined },
    ] },
    { label: "Game planning", icon: "i-lucide-dices", to: "/planning" },
  ],
  [
    { label: "Reference", type: "label" },
    { label: "Guidelines", icon: "i-lucide-book-open", to: "/guide" },
    {
      label: "Gallery",
      icon: "i-lucide-panels-top-left",
      type: "trigger",
      defaultOpen: true,
      children: [
        { label: "Components", icon: "i-lucide-blocks", to: "/gallery/components" },
        { label: 'API', icon: 'i-lucide-braces', to: '/gallery/api' },
        { label: "Layout recipes", icon: "i-lucide-layout-template", to: "/gallery/recipes" },
        { label: "Interaction states", icon: "i-lucide-activity", to: "/gallery/states" },
        { label: 'Page form', icon: 'i-lucide-square-pen', to: '/gallery/forms' },
        { label: 'Identity', icon: 'i-lucide-palette', to: '/gallery/identity' },
      ],
    },
  ],
]);
</script>
<template>
  <!-- Clip the fixed shell so anchor navigation only scrolls the panel body.
       `app-ground` marks it as the page ground: the panels are transparent, and
       an identity that wants a texture or a wash paints it here. -->
  <UDashboardGroup storage="local" unit="rem" class="app-ground overflow-clip">
    <UDashboardSidebar
      v-model:open="open"
      collapsible
      resizable
      :default-size="13.25"
      :min-size="12"
      :max-size="19"
      :collapsed-size="3.5"
      :menu="{ title: 'Navigation', description: 'Examples and reference pages' }"
      :ui="{ root: 'bg-muted', footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/courses"
          class="flex items-center gap-3 py-2 font-semibold text-highlighted"
          aria-label="Fieldwork home"
        >
          <span
            class="flex size-8 items-center justify-center rounded-lg bg-primary text-inverted"
            ><UIcon
name="i-lucide-blocks"
class="size-5"
          /></span>
          <span v-if="!collapsed"
            >Fieldwork<span class="ml-2 text-xs font-normal text-muted"
              >UI</span
            ></span
          >
        </NuxtLink>
      </template>
      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          :collapsed="collapsed"
          :ui="{ linkLabel: collapsed ? 'sr-only block' : '' }"
          tooltip
          popover
        />
      </template>
      <template #footer="{ collapsed }">
        <!-- Appearance on one row, account beneath it. Both are shell chrome:
             they change how the application looks and who is signed in, never
             what any control on a page does. -->
        <div class="flex w-full flex-col gap-2">
          <div
            class="flex w-full items-center gap-2"
            :class="collapsed ? 'flex-col' : ''"
          >
            <USelect
              v-if="!collapsed"
              :model-value="active"
              :items="identityItems"
              icon="i-lucide-palette"
              aria-label="Visual identity"
              class="min-w-0 flex-1"
              @update:model-value="select($event)"
            />
            <UDropdownMenu v-else :items="identityMenu" :content="{ side: 'right' }">
              <UTooltip text="Visual identity"><UButton
                icon="i-lucide-palette"
                aria-label="Visual identity"
                color="neutral"
                variant="ghost"
              /></UTooltip>
            </UDropdownMenu>
            <ClientOnly>
              <UDropdownMenu
                :items="appearanceMenu"
                :content="{ side: collapsed ? 'right' : 'top', align: 'end' }"
              >
                <UTooltip text="Appearance"><UButton
                  :icon="appearanceIcon"
                  aria-label="Appearance"
                  color="neutral"
                  variant="ghost"
                /></UTooltip>
              </UDropdownMenu>
              <template #fallback>
                <UButton
                  icon="i-lucide-monitor"
                  aria-label="Appearance"
                  color="neutral"
                  variant="ghost"
                  disabled
                />
              </template>
            </ClientOnly>
          </div>
          <UDropdownMenu
            :items="accountMenu"
            :content="{ side: collapsed ? 'right' : 'top', align: 'start' }"
            :ui="{ content: 'w-56' }"
          >
            <UTooltip :text="user.name" :disabled="!collapsed"><UButton
              color="neutral"
              variant="ghost"
              class="w-full"
              :aria-label="'Account: ' + user.name"
              ><UAvatar :alt="user.name" size="2xs" /><span
                v-if="!collapsed"
                class="min-w-0 flex-1 truncate text-left"
                >{{ user.name }}</span
              ><UIcon
                v-if="!collapsed"
                name="i-lucide-chevrons-up-down"
                class="size-4 shrink-0 text-dimmed"
            /></UButton></UTooltip>
          </UDropdownMenu>
        </div>
      </template>
    </UDashboardSidebar>
    <main id="main-content" class="flex min-w-0 flex-1"><slot /></main>
  </UDashboardGroup>
</template>
