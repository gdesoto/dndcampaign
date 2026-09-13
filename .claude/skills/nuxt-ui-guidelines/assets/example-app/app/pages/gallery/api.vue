<script setup lang="ts">
import { computed, ref } from 'vue';
import { componentApi } from '../../data/componentApi';

useHead({ title: 'Component API' });
const query = ref('');
const group = ref('All');
const toast = useToast();
const filtered = computed(() => {
  const term = query.value.trim().toLowerCase();
  return componentApi.filter(component =>
    (group.value === 'All' || component.group === group.value)
    && (!term || JSON.stringify(component).toLowerCase().includes(term)),
  );
});
async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.add({ title: 'Example copied', color: 'success' });
  } catch {
    toast.add({ title: 'Select and copy the example below', color: 'warning' });
  }
}
</script>

<template>
  <div class="min-w-0 space-y-6">
    <div class="max-w-3xl space-y-2">
      <p class="text-xs uppercase tracking-widest text-primary">The reference</p>
      <h2 class="text-base font-semibold text-highlighted">Component API</h2>
      <p class="text-sm text-muted">
        Props, defaults, events, slots, and complete usage examples for all
        {{ componentApi.length }} custom components. Start with the portable kit;
        demo components show how it connects to application data.
      </p>
    </div>

    <div class="rounded-lg border border-default bg-muted/30 p-4 text-sm text-muted">
      <p>
        These contracts describe the wrappers in this app. Native Nuxt UI props and slots
        are available only where the wrapper exposes or forwards them. Required props must
        be supplied; optional Boolean props default to false unless explicitly overridden.
        Arrows in the Default column indicate an effective fallback in the implementation.
      </p>
      <p class="mt-2">
        Examples are Vue single-file components for this Nuxt app, using its UApp and dashboard
        layout. Imports use the app’s <code>~</code> alias. Copy dependencies with a kit wrapper
        when moving it to another project. “None” means no declared wrapper API in that category.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Search components, props, or slots…"
        aria-label="Search component API"
        class="w-full sm:w-96"
      />
      <USelect
        v-model="group"
        :items="['All', 'Kit', 'Demo', 'Gallery']"
        aria-label="Component category"
        class="w-36"
      />
      <p class="text-xs text-muted" role="status">{{ filtered.length }} of {{ componentApi.length }} components</p>
      <UButton
        v-if="query || group !== 'All'"
        label="Clear filters"
        color="neutral"
        variant="ghost"
        @click="query = ''; group = 'All'"
      />
    </div>

    <nav v-if="filtered.length" aria-label="Jump to component" class="flex flex-wrap gap-2">
      <UButton
        v-for="component in filtered"
        :key="component.name"
        :to="`#${component.name}`"
        :label="component.name"
        color="neutral"
        variant="outline"
      />
    </nav>
    <UEmpty
v-else
icon="i-lucide-search-x"
title="No matching components"
description="Try a component name, prop, event, or a different category." />

    <section
      v-for="component in filtered"
      :id="component.name"
      :key="component.name"
      :aria-labelledby="`${component.name}-heading`"
      class="min-w-0 scroll-mt-6 overflow-hidden rounded-lg border border-default"
    >
      <div class="space-y-2 border-b border-default bg-muted/30 p-4 sm:p-5">
        <div class="flex flex-wrap items-center gap-3">
          <h3 :id="`${component.name}-heading`" class="font-mono text-sm font-semibold text-highlighted">{{ component.name }}</h3>
          <UBadge :label="component.group" color="neutral" variant="subtle" />
          <NuxtLink :to="`#${component.name}`" :aria-label="`Link to ${component.name}`" class="text-muted hover:text-primary">#</NuxtLink>
        </div>
        <p class="text-sm">{{ component.summary }}</p>
        <p class="break-words font-mono text-xs text-muted">app/components/{{ component.group.toLowerCase() }}/{{ component.name }}.vue</p>
        <p class="text-xs text-muted"><span class="font-medium text-default">Dependencies: </span>{{ component.dependencies }}</p>
      </div>

      <div class="min-w-0 space-y-6 p-4 sm:p-5">
        <div>
          <h4 class="mb-3 text-sm font-semibold">Props</h4>
          <div
            class="overflow-x-auto rounded-md border border-default"
            role="region"
            :aria-label="`${component.name} props`"
            tabindex="0"
          >
            <table class="w-full min-w-[720px] text-left text-sm">
              <caption class="sr-only">{{ component.name }} props, valid types and options, defaults, and usage</caption>
              <thead class="border-b border-default bg-muted/30 text-xs text-muted">
                <tr><th scope="col" class="p-3">Prop</th><th scope="col" class="p-3">Type / valid options</th><th scope="col" class="p-3">Default</th><th scope="col" class="p-3">Usage</th></tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="prop in component.props" :key="prop.name" class="align-top">
                  <th scope="row" class="p-3 font-mono text-xs font-medium text-highlighted">{{ prop.name }}</th>
                  <td class="max-w-80 break-words p-3 font-mono text-xs">{{ prop.type }}</td>
                  <td class="max-w-64 break-words p-3 text-xs text-muted">{{ prop.default }}</td>
                  <td class="min-w-56 p-3 text-xs leading-relaxed text-muted">{{ prop.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div v-for="kind in (['events', 'slots'] as const)" :key="kind">
            <h4 class="mb-3 text-sm font-semibold">{{ kind === 'events' ? 'Events & v-model' : 'Slots & scope' }}</h4>
            <p v-if="!component[kind].length" class="text-sm text-muted">None.</p>
            <dl v-else class="space-y-3">
              <div v-for="member in component[kind]" :key="member.name" class="space-y-1">
                <dt class="break-words font-mono text-xs font-semibold text-highlighted">{{ member.name }}</dt>
                <dd class="break-words font-mono text-xs text-muted">{{ member.signature }}</dd>
                <dd class="text-sm text-muted">{{ member.description }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div>
          <h4 class="mb-3 text-sm font-semibold">Exposed methods & refs</h4>
          <p v-if="!component.exposed?.length" class="text-sm text-muted">None.</p>
          <dl v-else class="space-y-3">
            <div v-for="member in component.exposed" :key="member.name">
              <dt class="break-words font-mono text-xs font-semibold">{{ member.name }}: {{ member.signature }}</dt>
              <dd class="mt-1 text-sm text-muted">{{ member.description }}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 class="mb-3 text-sm font-semibold">Behavior & integration</h4>
          <ul class="list-disc space-y-2 pl-5 text-sm text-muted">
            <li v-for="note in component.notes" :key="note">{{ note }}</li>
          </ul>
        </div>

        <div class="min-w-0">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h4 class="text-sm font-semibold">Usage example</h4>
            <UButton
              label="Copy example"
              icon="i-lucide-copy"
              :aria-label="`Copy ${component.name} example`"
              color="neutral"
              variant="ghost"
              @click="copy(component.example)"
            />
          </div>
          <pre
            class="overflow-x-auto rounded-lg border border-default bg-muted/30 p-4 text-xs leading-relaxed"
            tabindex="0"
            :aria-label="`${component.name} usage example`"
          ><code>{{ component.example }}</code></pre>
        </div>
      </div>
    </section>
  </div>
</template>
