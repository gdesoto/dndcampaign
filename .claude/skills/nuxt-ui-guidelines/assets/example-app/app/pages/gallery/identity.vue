<script setup lang="ts">
import StatCard from '../../components/kit/StatCard.vue';
import ListItem from '../../components/kit/ListItem.vue';
import InlineStatus from '../../components/kit/InlineStatus.vue';
const { identities, identity, active, select } = useIdentity();
const { courses } = useDemo();
const layers = [
  { layer: 'app/assets/css/main.css', owns: 'Typefaces, the type scale, page padding, --ui-radius. Values, never decisions.', mechanism: 'A class on <html>, so overlays rendered in a portal inherit it too.' },
  { layer: 'app/app.config.ts', owns: 'Semantic color aliases and shared component defaults.', mechanism: 'ui.colors, applied at runtime here so the switch needs no reload.' },
  { layer: 'UTheme', owns: 'Component slot classes and prop defaults for one subtree.', mechanism: 'Native provide/inject; outranks app.config, outranked by a component’s own ui and class props.' },
  { layer: 'A composition’s ui prop', owns: 'The single instance that genuinely differs.', mechanism: 'Unused by these identities — nothing here needed a one-off.' },
  { layer: 'Character', owns: 'Ground, texture, ornament, and what happens under the cursor. Stands for nothing but the product.', mechanism: 'Classes in main.css: the ground on the shell element, the hover treatment reached through a shared component default. Neither can drift between pages.' },
];
const unchanged = [
  'The action vocabulary: Open · Edit · Duplicate · Archive · Delete, in that order.',
  'Which actions confirm, and which are recoverable through Undo.',
  'Empty, loading, error, and disabled states, and where focus lands after each.',
  'Canonical field order across tables, mobile lists, and detail facts.',
  'Every route, page structure, and keyboard path.',
];
useHead({ title: 'Identity' });
</script>
<template>
  <div class="min-w-0 space-y-6">
    <div class="max-w-3xl space-y-2">
      <p class="text-xs uppercase tracking-widest text-primary">The test for a host</p>
      <h2 class="font-display text-base font-semibold text-highlighted">One application, three identities</h2>
      <p class="text-sm text-muted">
        A stranger should be able to tell your application from this example at a glance, and
        operate it without learning anything new. These three identities run the same pages,
        components, verbs, and confirmations; switching one changes only configuration, and it
        changes the whole app, not this page. Pick one here or from the sidebar.
      </p>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <UCard
        v-for="option in identities"
        :key="option.id"
        :class="option.id === active ? 'ring-2 ring-primary' : ''"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-2 font-semibold text-highlighted"
              ><UIcon :name="option.icon" class="size-4 text-muted" />{{ option.label }}</span
            >
            <InlineStatus v-if="option.id === active" label="Active" color="success" />
          </div>
        </template>
        <p class="text-muted">{{ option.description }}</p>
        <template #footer>
          <UButton
            :label="option.id === active ? 'Currently applied' : 'Use this identity'"
            :color="option.id === active ? 'neutral' : 'primary'"
            :variant="option.id === active ? 'outline' : 'solid'"
            :disabled="option.id === active"
            block
            @click="select(option.id)"
          />
        </template>
      </UCard>
    </div>

    <section class="overflow-hidden rounded-md border border-default">
      <div class="border-b border-default bg-muted/30 px-4 py-3">
        <h3 class="font-mono text-sm font-medium">{{ identity.label }} · live compositions</h3>
      </div>
      <div class="grid gap-4 p-4 xl:grid-cols-2">
        <div class="space-y-3">
          <p class="font-display text-page-title font-semibold text-highlighted">A page title</p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton label="New course" icon="i-lucide-plus" />
            <UButton label="Edit" color="neutral" variant="outline" />
            <UButton label="Archive" color="neutral" variant="ghost" />
            <UTooltip text="Delete course"><UButton
              icon="i-lucide-trash-2"
              aria-label="Delete course"
              color="neutral"
              variant="ghost"
            /></UTooltip>
          </div>
          <div class="flex flex-wrap gap-2">
            <InlineStatus label="Active" color="success" /><InlineStatus label="Draft" /><InlineStatus
              label="Needs review"
              color="warning"
            />
          </div>
          <UInput placeholder="Search records…" aria-label="Preview search" icon="i-lucide-search" />
          <StatCard
            icon="i-lucide-graduation-cap"
            label="Active courses"
            :value="courses.filter(c => c.status === 'Active').length"
            :delta="'of ' + courses.length"
            :progress="courses.length ? courses.filter(c => c.status === 'Active').length / courses.length * 100 : 0"
          />
        </div>
        <div class="space-y-3">
          <UCard v-if="courses[0]">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-semibold text-highlighted">{{ courses[0].name }}</span>
                <InlineStatus :label="courses[0].status" :color="statusColor(courses[0].status)" />
              </div>
            </template>
            <dl class="grid grid-cols-[5rem_1fr] gap-2">
              <dt class="text-xs text-muted">Credits</dt><dd>{{ courses[0].credits }}</dd>
              <dt class="text-xs text-muted">Enrolment</dt><dd>{{ courses[0].studentIds.length }} students</dd>
            </dl>
            <template #footer>
              <UButton
label="Open course"
:to="'/courses/' + courses[0].id"
color="neutral"
variant="outline" />
            </template>
          </UCard>
          <UCard>
            <ListItem
              v-for="course in courses.slice(0, 3)"
              :key="course.id"
              :title="course.name"
              :to="'/courses/' + course.id"
            ><template #actions><span class="text-xs tabular-nums text-muted">{{ course.studentIds.length }} students</span></template></ListItem>
          </UCard>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">What each layer owns</h3>
      <div class="overflow-x-auto rounded-md border border-default">
        <table class="w-full text-data">
          <thead class="bg-muted text-xs text-muted">
            <tr><th class="px-3 py-1.5 text-left font-medium">Layer</th><th class="px-3 py-1.5 text-left font-medium">Owns</th><th class="px-3 py-1.5 text-left font-medium">How it reaches the page</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in layers" :key="row.layer" class="border-t border-default align-top">
              <td class="px-3 py-2 font-mono text-xs text-highlighted">{{ row.layer }}</td>
              <td class="px-3 py-2">{{ row.owns }}</td>
              <td class="px-3 py-2 text-muted">{{ row.mechanism }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">{{ identity.label }} · the whole definition</h3>
      <p class="max-w-3xl text-data text-muted">
        Every difference between this identity and the reference is below. No component source,
        no page style block, no deep selector into a component’s internals.
      </p>
      <div class="grid gap-3 xl:grid-cols-3">
        <div v-for="block in [{ label: 'CSS tokens', code: identity.css }, { label: 'Runtime colors', code: identity.config }, { label: 'Component defaults', code: identity.theme }]" :key="block.label" class="min-w-0 space-y-2">
          <p class="font-mono text-xs uppercase tracking-widest text-primary">{{ block.label }}</p>
          <pre class="overflow-x-auto rounded-lg border border-default bg-muted/30 p-3 text-xs leading-relaxed"><code>{{ block.code }}</code></pre>
        </div>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-sm font-semibold text-highlighted">What no identity may change</h3>
      <ul class="max-w-3xl list-disc space-y-1 pl-5 text-data text-muted">
        <li v-for="rule in unchanged" :key="rule">{{ rule }}</li>
      </ul>
      <p class="max-w-3xl text-data text-muted">
        Review each identity in light and dark, including hover, disabled, and error states. A
        look that cannot be expressed in the layers above is a reason to reconsider the look, or
        to add a token for it, before scattering it across pages. Hover a campaign card to see
        the one treatment here that means nothing at all: character is a layer of its own, and an
        application without it is competent and dead.
      </p>
    </section>
  </div>
</template>
