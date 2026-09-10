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
        base: 'max-w-full font-display font-semibold tracking-[0.08em] uppercase transition-all cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed pointer-coarse:min-h-11 pointer-coarse:min-w-11',
      },
      defaultVariants: {
        size: 'md',
        color: 'neutral',
        variant: 'outline',
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: { base: 'text-neutral-950' } },
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
        color: 'neutral',
        variant: 'outline',
      },
    },

    card: {
      slots: {
        root: 'rounded-md overflow-hidden relative',
        //header: 'px-4 py-2.5 border-b border-[var(--ui-border)] flex items-center justify-between',
        header: `${cardSectionPadding} flex items-center justify-between [&>*]:w-full`,
        //body: 'p-4',
        body: cardSectionPadding,
        //footer: 'px-4 py-2 border-t border-[var(--ui-border)] flex gap-2 justify-end',
        footer: `${cardSectionPadding} flex gap-2 justify-end`,
      },
      variants: {
        variant: {
          outline: { root: 'bg-elevated ring ring-default divide-y divide-muted dmvault-card' },
          soft: { root: 'bg-muted/45 ring-0 divide-y divide-muted' },
          subtle: { root: 'bg-muted/45 ring ring-muted divide-y divide-muted' },
        },
      },
      defaultVariants: {
        variant: 'outline',
      },
    },

    tabs: {
      slots: {
        root: 'flex flex-col',
        list: 'flex border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-0', // px-6
        trigger: // grow justify-center
          'rounded-none font-display tracking-[0.08em] uppercase text-[var(--ui-text-dimmed)] px-3.5 py-2.5 border-b-2 border-transparent -mb-px transition-all cursor-pointer hover:text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accented)]/60 data-[state=active]:rounded-none data-[state=active]:text-primary data-[state=active]:bg-[var(--ui-bg-accented)] data-[state=active]:border-primary-500',
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
        wrapper: 'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        headline: 'mb-1 text-sm uppercase tracking-[0.08em] text-[var(--ui-text-dimmed)] font-display',
        title: 'min-w-0 break-words type-title text-[length:var(--text-title)] sm:text-[length:var(--text-title)] font-semibold',
        description: 'text-sm text-[var(--ui-text-muted)]',
        links: 'flex max-w-full flex-wrap items-center gap-2 sm:justify-end',
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
