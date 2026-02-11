const panelFieldBase =
  'w-full rounded-sm border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] text-default placeholder:text-muted focus:outline-none'
const cardSectionPadding = 'p-2 xl:p-4 xl:py-2'

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
        root: 'theme-card rounded-lg xl:py-2 overflow-hidden',
        header: `${cardSectionPadding} border-b-0`,
        body: `${cardSectionPadding} border-b-0`,
        footer: cardSectionPadding,
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
        base: panelFieldBase,
      },
      defaultVariants: {
        size: 'md',
      },
    },
    textarea: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base: panelFieldBase,
      },
      defaultVariants: {
        size: 'md',
      },
    },
    modal: {
      variants: {
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-2rem)] max-w-lg rounded-lg shadow-lg ring ring-default',
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
        content: 'rounded-lg shadow-2xl',
      },
    },
    tooltip: {
      slots: {
        content: 'rounded-2xl shadow-2xl',
      },
    },
    page: {
      slots: {
        root: 'flex flex-col lg:grid lg:grid-cols-10 lg:gap-10',
      },
    },
  },
})
