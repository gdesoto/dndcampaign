export default defineAppConfig({
  ui: {
    colors: {
      primary: 'forest',
      secondary: 'ember',
      neutral: 'parchment',
    },
    button: {
      slots: {
        base: 'rounded-full font-medium inline-flex items-center transition-colors cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
      },
      defaultVariants: {
        size: 'md',
        color: 'primary',
        variant: 'solid',
      },
    },
    card: {
      slots: {
        root: 'theme-card rounded-2xl overflow-hidden',
        header: 'p-5 sm:p-6 border-b border-[var(--theme-card-border)]',
        body: 'p-5 sm:p-6',
        footer: 'p-5 sm:p-6 border-t border-[var(--theme-card-border)]',
      },
      defaultVariants: {
        variant: 'outline',
      },
    },
    input: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base:
          'w-full rounded-sm border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] text-default placeholder:text-muted focus:outline-none',
      },
      defaultVariants: {
        size: 'md',
      },
    },
    textarea: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base:
          'w-full rounded-sm border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] text-default placeholder:text-muted focus:outline-none',
      },
      defaultVariants: {
        size: 'md',
      },
    },
    modal: {
      slots: {
        overlay: 'bg-black/70 backdrop-blur-sm',
        content:
          'bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-xl ring ring-default',
      },
    },
    badge: {
      variants: {
        size: {
          sm: {
            base: 'text-[10px]/3 px-1.5 py-1 gap-1 rounded-full',
          },
        },
      },
      defaultVariants: {
        size: 'sm',
      },
    },
    dropdownMenu: {
      slots: {
        content: 'rounded-2xl shadow-2xl',
      },
    },
    tooltip: {
      slots: {
        content: 'rounded-2xl shadow-2xl',
      },
    },
  },
})
