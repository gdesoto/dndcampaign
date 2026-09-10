export default defineAppConfig({
  ui: {
    colors: { primary: "blue", neutral: "slate" },
    // Native sizes keep labels, icons and embedded controls proportionate.
    // Customize size variants here when the app needs a different scale.
    button: { slots: { base: "font-medium" }, compoundVariants: [{ color: 'neutral', variant: 'ghost', class: 'text-muted hover:text-highlighted focus-visible:text-highlighted hover:bg-elevated focus-visible:bg-elevated' }], defaultVariants: { size: "md" } },
    input: { defaultVariants: { size: 'md' } },
    inputNumber: { defaultVariants: { size: 'md' } },
    select: { defaultVariants: { size: 'md' } },
    selectMenu: { defaultVariants: { size: 'md' } },
    tabs: { defaultVariants: { size: 'md' } },
    accordion: { slots: { trigger: 'py-2 text-data', body: 'pb-2' } },
    badge: { slots: { base: "rounded font-medium" }, defaultVariants: { variant: "subtle", size: "sm" } },
    // Soft and subtle ship as bg-elevated/50. Opaque here instead: a quiet
    // surface should be a lighter one, not a window onto the page ground.
    // Translucency behind running text is what lets a texture or gradient
    // reach the words sitting on it.
    card: { slots: { root: "rounded-lg shadow-none", header: "px-3 py-2.5 sm:px-3", body: "p-3 sm:p-3", footer: "px-3 py-2 sm:px-3" }, variants: { variant: { soft: { root: "bg-elevated" }, subtle: { root: "bg-elevated" } } } },
    table: { slots: { th: "px-3 py-1.5 text-xs font-medium text-muted bg-muted", td: "px-3 py-1 text-data h-9" } },
    skeleton: { base: "motion-reduce:animate-none" },
    dashboardPanel: { slots: { body: "p-3 sm:p-page gap-3 sm:gap-4" } },
  },
});
