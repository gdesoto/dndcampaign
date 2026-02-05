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
        root: 'theme-card rounded-ld xl:py-2 overflow-hidden',
        header: 'p-2 xl:p-4 xl:py-2 border-b-0', // border-[var(--theme-card-border)]',
        body: 'p-2 xl:p-4 xl:py-2 border-b-0', //
        footer: 'p-2 xl:p-4 xl:py-2', // border-t-0 border-[var(--theme-card-border)]',
      },
      variants: {
        variant: {
          solid: {
            root: 'bg-inverted text-inverted'
          },
          outline: {
            root: 'bg-default ring ring-default divide-y divide-default'
          },
          soft: {
            root: 'bg-elevated/50 divide-y divide-default'
          },
          subtle: {
            root: 'bg-elevated/50 ring ring-default divide-y divide-default'
          }
        }
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
        // overlay: 'bg-black/70 backdrop-blur-sm',
        // content: 'bg-[var(--theme-card-bg)] divide-y divide-default flex flex-col focus:outline-none',
      },
      variants: {
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-2rem)] max-w-lg rounded-2xl shadow-2xl ring ring-default',
          }
        }
      }
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
