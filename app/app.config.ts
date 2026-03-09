const fieldBase =
  'w-full bg-[var(--ui-bg-accented)] border border-[var(--ui-border-muted)] rounded font-sans text-[var(--ui-text)] placeholder:text-[var(--ui-text-dimmed)] placeholder:italic outline-none transition-colors hover:border-[var(--ui-border)] focus:border-[var(--ui-border-accented)] focus:ring-1 focus:ring-[var(--ui-border-accented)]/20 dark:border-[var(--ui-border)] disabled:opacity-70 disabled:cursor-not-allowed'
const cardSectionPadding = 'p-3 xl:p-4 xl:py-2'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      neutral: 'neutral',
      error: 'error',
      success: 'success',
      info: 'info',
      warning: 'warning',
    },

    button: {
      slots: {
        base: 'font-display font-semibold tracking-widest uppercase transition-all cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
      },
      variants: {
        variant: {
          solid: {
            base: 'bg-primary-500 text-neutral-950 border border-primary-400/65 hover:bg-primary-400 hover:border-primary-400/75 dark:border-primary-400',
          },
          outline: {
            base: 'bg-primary-500/10 border border-primary-700/60 text-primary-600 hover:bg-primary-500/20 hover:border-primary-600/70 dark:border-primary-700 dark:hover:border-primary-600 dark:text-primary-400',
          },
          ghost: {
            base: 'bg-transparent border border-[var(--ui-border-muted)] text-[var(--ui-text-muted)] hover:border-[var(--ui-border)] hover:text-[var(--ui-text)] dark:border-[var(--ui-border)] dark:hover:border-[var(--ui-border-accented)]',
          },
          soft: {
            base: 'bg-[var(--ui-bg-accented)] border border-[var(--ui-border-muted)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:border-[var(--ui-border)] hover:text-[var(--ui-text)]',
          },
          subtle: {
            base: 'bg-transparent border border-transparent text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accented)] hover:text-[var(--ui-text)]',
          },
          link: {
            base: 'bg-transparent border-transparent text-primary-700 hover:text-primary-500 p-0 dark:text-primary-600 dark:hover:text-primary-400',
          },
        },
      },
      defaultVariants: {
        size: 'md',
        color: 'primary',
        variant: 'outline',
      },
      compoundVariants: [
        {
          color: 'error',
          variant: 'soft',
          class: { base: 'bg-error-500/15 border border-error-600/28 text-error-600 hover:bg-error-500/25 hover:border-error-600/38 dark:border-error-600/40 dark:text-error-400' },
        },
      ],
    },

    badge: {
      slots: {
        base: 'font-display tracking-[0.08em] uppercase',
      },
      defaultVariants: {
        size: 'sm',
        color: 'primary',
        variant: 'outline',
      },
    },

    card: {
      slots: {
        root: 'bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] rounded-md overflow-hidden transition-colors hover:border-[var(--ui-border-accented)] relative group dmvault-card',
        //header: 'px-4 py-2.5 border-b border-[var(--ui-border)] flex items-center justify-between',
        header: `${cardSectionPadding} border-b border-[var(--ui-border)] flex items-center justify-between [&>*]:w-full`,
        //body: 'p-4',
        body: cardSectionPadding,
        //footer: 'px-4 py-2 border-t border-[var(--ui-border)] flex gap-2 justify-end',
        footer: `${cardSectionPadding} border-t border-[var(--ui-border)] flex gap-2 justify-end`,
      },
      defaultVariants: {
        variant: 'subtle',
      },
    },

    tabs: {
      slots: {
        root: 'flex flex-col',
        list: 'flex border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-0', // px-6
        trigger: // grow justify-center
          'rounded-none font-display tracking-[0.1em] uppercase text-[var(--ui-text-dimmed)] px-3.5 py-2.5 border-b-2 border-transparent -mb-px transition-all cursor-pointer hover:text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accented)]/60 data-[state=active]:rounded-none data-[state=active]:text-primary data-[state=active]:bg-[var(--ui-bg-accented)] data-[state=active]:border-primary-500',
        indicator: 'hidden',
        label: 'truncate text-inherit',
        content: 'outline-none',
      },
      defaultVariants: {
        variant: 'link',
        color: 'primary',
        size: 'md',
      },
    },

    input: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base: fieldBase,
      },
      defaultVariants: {
        size: 'md',
        color: 'neutral',
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: ['outline', 'subtle'],
          class:
            'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ui-border-accented)]/30 dark:focus-visible:ring-[var(--ui-border-accented)]/35',
        },
        {
          color: 'neutral',
          highlight: true,
          class: 'ring ring-inset ring-[var(--ui-border-accented)]/30 dark:ring-[var(--ui-border-accented)]/35',
        },
      ],
    },

    textarea: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base: fieldBase,
      },
      defaultVariants: {
        size: 'md',
        color: 'neutral',
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: ['outline', 'subtle'],
          class:
            'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ui-border-accented)]/30 dark:focus-visible:ring-[var(--ui-border-accented)]/35',
        },
        {
          color: 'neutral',
          highlight: true,
          class: 'ring ring-inset ring-[var(--ui-border-accented)]/30 dark:ring-[var(--ui-border-accented)]/35',
        },
      ],
    },

    dropdownMenu: {
      slots: {
        content: 'rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] shadow-2xl',
      },
    },

    tooltip: {
      slots: {
        content:
          'rounded-[3px] border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] text-[var(--ui-text)] italic shadow-xl',
      },
    },

    separator: {
      slots: {
        border: 'border-[var(--ui-border)]',
      },
    },

    navigationMenu: {
      slots: {
        linkLeadingIcon: 'shrink-0 size-6',
        linkLabel: 'truncate font-display tracking-[0.08em] uppercase',
      },
    },

    modal: {
      variants: {
        fullscreen: {
          false: {
            content:
              'w-[calc(100vw-2rem)] max-w-lg rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] shadow-2xl',
          },
        },
      },
    },

    page: {
      slots: {
        root: 'flex flex-col lg:grid lg:grid-cols-10 lg:gap-10',
      },
    },

    pageHeader: {
      slots: {
        root: 'relative pb-4 pt-0 border-b border-[var(--ui-border)]',
        wrapper: 'flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between',
        headline: 'mb-1 text-sm uppercase tracking-[0.3em] text-[var(--ui-text-dimmed)] font-display',
        title: 'text-2xl font-display font-semibold text-[var(--ui-text-highlighted)]',
        description: 'text-sm text-[var(--ui-text-muted)]',
        links: 'flex flex-wrap items-center gap-1.5',
      },
      variants: {
        title: {
          true: {
            description: 'mt-1 text-sm text-[var(--ui-text-muted)]',
          },
        },
      },
    },
  },
})
