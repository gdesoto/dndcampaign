export default defineAppConfig({
  ui: {
    colors: { primary: "blue", neutral: "slate" },
    button: { slots: { base: "font-medium touch-target" }, variants: { square: { true: 'justify-center aspect-square' } }, compoundVariants: [{ color: 'neutral', variant: 'ghost', class: 'text-muted hover:text-highlighted focus-visible:text-highlighted hover:bg-elevated focus-visible:bg-elevated' }], defaultVariants: { size: "sm" } },
    input: { slots: { base: 'touch-target' } },
    inputNumber: { slots: { base: 'touch-target touch-number' } },
    select: { slots: { base: 'touch-target', item: 'touch-target items-center' } },
    selectMenu: { slots: { base: 'touch-target', item: 'touch-target items-center' } },
    navigationMenu: { slots: { link: 'touch-target' } },
    tabs: { slots: { trigger: 'touch-target justify-center' } },
    accordion: { slots: { trigger: 'touch-target py-2 text-data', body: 'pb-2' } },
    badge: { slots: { base: "rounded font-medium" }, defaultVariants: { variant: "subtle", size: "sm" } },
    card: { slots: { root: "rounded-lg shadow-none", header: "px-3 py-2.5 sm:px-3", body: "p-3 sm:p-3", footer: "px-3 py-2 sm:px-3" } },
    table: { slots: { th: "px-3 py-1.5 text-xs font-medium text-muted bg-muted", td: "px-3 py-1 text-data h-9" } },
    skeleton: { base: "motion-reduce:animate-none" },
    dashboardPanel: { slots: { body: "p-3 sm:p-page gap-3 sm:gap-4" } },
  },
});
