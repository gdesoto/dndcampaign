<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui";
defineProps<{ title: string; count?: string | number; breadcrumbs?: BreadcrumbItem[] }>();
</script>
<template>
  <UDashboardNavbar :title="title" :ui="{ root: 'h-auto min-h-20 py-3 flex-wrap', left: 'flex-1 min-w-0', title: 'block min-w-0 flex-1', right: 'ml-auto flex-wrap' }">
    <template #left><UDashboardSidebarCollapse />
      <div class="min-w-0 flex-1"><UBreadcrumb v-if="breadcrumbs?.length" :items="breadcrumbs" class="mb-1 text-xs" />
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <!-- `font-display` names a role, not a face: identities that give titles
             their own face define the token, the rest inherit the body face. -->
        <h1 class="min-w-0 break-words font-display text-page-title font-semibold text-highlighted" tabindex="-1" data-focus-fallback>{{ title }}</h1>
        <span v-if="count !== undefined" class="text-xs font-normal text-muted">{{ count }}</span>
      </div></div></template
    >
    <template #right><slot name="actions" /></template>
  </UDashboardNavbar>
  <UDashboardToolbar v-if="$slots.default">
    <slot />
  </UDashboardToolbar>
</template>
