<script setup lang="ts">
type NavItem = {
  label: string
  to: string
  icon: string
}

type BreadcrumbItem = {
  label: string
  to?: string
}

defineProps<{
  navItems: NavItem[]
  breadcrumbItems: BreadcrumbItem[]
}>()
</script>

<template>
  <UCard>
    <UBreadcrumb :items="breadcrumbItems" />
  </UCard>

  <UCard>
    <UNavigationMenu :items="navItems" class="w-full" />
  </UCard>
</template>
