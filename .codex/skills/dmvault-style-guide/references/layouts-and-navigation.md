# Layouts And Navigation

## Scope

Use for `app.vue`, `app/layouts/*.vue`, route shell composition, breadcrumbs, and nav structure.

## Three-layer architecture

1. `app.vue`: minimal shell (`UApp -> UMain -> NuxtLayout -> NuxtPage`), no route chrome.
2. Layouts: own visual shell/chrome by domain.
3. Pages: route content only.

## Layout contracts

- `default`: marketing/public style pages, header + footer.
- `docs`: docs content with asides/content navigation.
- `dashboard`: campaign app shell with `UDashboardGroup`, sidebar, panel content.
- `auth`: minimal centered shell with no shared chrome.

## Dashboard rules

- Campaign routes use dashboard layout.
- Sidebar remains collapsible with full hide behavior (`collapsed-size="0"`).
- Panel content scroll behavior should stay inside panel body.
- Use `UDashboardNavbar` for panel-level context, with breadcrumb strategy as needed.
- Use unique panel storage keys: `dmvault-{view}-{role}`.

## Navigation rules

- Internal links: `to` prop / `NuxtLink`, never bare anchors.
- Header menu: explicit active state via prefix matching when needed.
- Sidebar menu: rely on router active behavior.
- Breadcrumb depth pattern:
  - `Campaign > Section > Item` for deeper routes.

## Common pitfalls

- Duplicating header/nav context in both layout and page shells.
- Losing mobile navigation path when sidebar hides.
- Mixing section navigation (sidebar routes) with in-page tabs.

