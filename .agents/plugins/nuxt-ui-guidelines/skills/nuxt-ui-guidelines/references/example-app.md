# Example application: inspiration and starting point

The complete source lives in [../assets/example-app](../assets/example-app). Preserve the variety: gallery recipes, interaction states, identity variations, course workflows, and planning pages demonstrate different useful compositions. Do not reduce the reference to a single generic CRUD screen.

## Choose a reference

All source paths below are relative to `assets/example-app/`. Read the relevant page and follow its component/composable imports instead of loading the whole application into context.

| Need | Source | App route |
| --- | --- | --- |
| Shared shell and navigation | app/app.vue, app/layouts/default.vue | All pages |
| Dashboard summaries and drill-ins | app/pages/index.vue | / |
| Gallery overview | app/pages/gallery/index.vue | /gallery |
| Live component variants | app/pages/gallery/components.vue | /gallery/components |
| Layout and composition recipes | app/pages/gallery/recipes.vue | /gallery/recipes |
| Loading, failure, empty and retry examples | app/pages/gallery/states.vue | /gallery/states |
| Modal/page form lifecycle | app/pages/gallery/forms.vue | /gallery/forms |
| Distinct visual identities | app/pages/gallery/identity.vue, app/data/identities.ts, app/composables/useIdentity.ts | /gallery/identity |
| Searchable component API and copyable snippets | app/pages/gallery/api.vue, app/data/componentApi.ts | /gallery/api |
| Collection/table workflow | app/pages/courses/index.vue | /courses |
| Operational workflows | app/pages/courses/sections.vue, app/pages/courses/requests.vue | /courses/sections, /courses/requests |
| Persistent detail with related records and child routes | app/pages/courses/[id].vue, app/pages/courses/[id]/ | /courses/:id and child sections |
| Planning cards, alternate views and detail | app/pages/planning/ | /planning and /planning/:id |
| Shared design specification | ../../references/guidelines.md, app/pages/guide.vue | /guide |
| Portable source | app/components/kit/ | See component gallery |
| Domain fields and orchestration | app/components/demo/, app/composables/, app/utils/ | Follow relevant page imports |

## Existing project

Use the examples as inspiration and working implementation references. Transfer the relevant patterns, components and dependency set from [adoption.md](adoption.md); merge theme decisions into the host. Keep the host's data model, branding, routes, rendering mode and services unless the user asks to change them. Fictional course and planning data should not enter production components.

## Run or start a new project

For a runnable reference, copy the whole skill folder into an appropriate working area, preserving `references/` beside `assets/`, then run commands from `assets/example-app/`. Its guide page imports the single canonical `references/guidelines.md`, with a scoped Vite filesystem allowance. To start an independent app by copying only `assets/example-app/`, also copy the canonical guide into that new app root as `GUIDELINES.md`, change `app/pages/guide.vue` to import `../../GUIDELINES.md?raw`, and remove the external-guide `vite.server.fs.allow` configuration. This creates a separate project snapshot, not a second guide in the skill. Use the package manager/version recorded in package.json:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The source README has the typecheck/lint/test/build commands and SPA deployment notes. Keep the lockfile. Install dependencies in the working copy, not the distributable skill assets. The demo remains a client-rendered, in-memory reference: refresh restores fictional data. Adapting it into a product requires the host's persistence and business rules. Preserve the varied examples for reference even when choosing a smaller production surface.

For a new project, the full app may be the starting point; adapt domain pages/configuration deliberately. For an existing project, do not replace its configuration with the example's.

## Bundle scope and maintenance

Includes application/public source, gallery, fictional data, tests, configuration, package manifest/lockfile, documentation, license, and the non-secret `.env.example` template. Excludes node_modules, Git history, build output, caches, local environment files, screenshots and historical verification artifacts. The external HTML inspiration is not needed to run the app.

The kit exists only in `app/components/kit/`; there is no separate copy to synchronize. The single bundled specification lives in `references/guidelines.md`. Packaging changes point the app guide page to that reference, permit that file through Vite's development filesystem boundary, and update README paths/history references. Other application sources remain the original snapshot. When refreshing the bundle, preserve these portability changes and recheck imports, source parity, lockfile, and relevant behavior.
