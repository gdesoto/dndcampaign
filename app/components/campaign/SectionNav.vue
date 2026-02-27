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
  <UCard :ui="{ body: 'p-3 md:p-4' }">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div class="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
        <UBreadcrumb
          :items="breadcrumbItems"
          class="w-max min-w-max md:w-auto md:min-w-0"
          :ui="{
            list: 'flex-nowrap whitespace-nowrap md:flex-wrap',
            item: 'shrink-0',
            link: 'whitespace-nowrap'
          }"
        />
      </div>
      <div class="md:hidden">
        <UNavigationMenu
          :items="navItems"
          orientation="vertical"
          class="data-[orientation=vertical]:w-full"
          :ui="{
            linkLabel: 'whitespace-nowrap'
          }"
        />
      </div>
      <div class="hidden pb-1 md:block md:pb-0 xl:max-w-[70%]">
        <UNavigationMenu
          :items="navItems"
          class="w-full"
          :ui="{
            list: 'flex-wrap whitespace-nowrap xl:flex-nowrap',
            item: 'shrink-0',
            link: 'whitespace-nowrap',
            linkLabel: 'whitespace-nowrap'
          }"
        />
      </div>
    </div>
  </UCard>
</template>
