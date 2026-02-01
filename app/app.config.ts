export default defineAppConfig({
  ui: {
    colors: {
      primary: 'amber',
      gray: 'slate',
    },
    button: {
      slots: {
        base: 'rounded-md font-medium inline-flex items-center transition-colors',
      },
      default: {
        size: 'md',
        color: 'primary',
        variant: 'solid',
      },
    },
    card: {
      slots: {
        root: 'rounded-xl overflow-hidden bg-white/80 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:ring-slate-800',
        header: 'p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800',
        body: 'p-5 sm:p-6',
        footer: 'p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800',
      },
      defaultVariants: {
        variant: 'outline',
      },
    },
    input: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base:
          'w-full rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500',
      },
      rounded: 'rounded-md',
      size: 'md',
    },
    textarea: {
      slots: {
        root: 'relative inline-flex items-center w-full',
        base:
          'w-full rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500',
      },
      rounded: 'rounded-md',
      size: 'md',
    },
    modal: {
      background: 'bg-white dark:bg-slate-950',
      overlay: 'bg-slate-950/80 backdrop-blur-sm',
      container: 'items-center',
      rounded: 'rounded-xl',
      width: 'sm:max-w-xl',
      shadow: 'shadow-2xl',
    },
    badge: {
      rounded: 'rounded-full',
      size: 'sm',
    },
    dropdown: {
      rounded: 'rounded-md',
      shadow: 'shadow-xl',
    },
    tooltip: {
      rounded: 'rounded-md',
      shadow: 'shadow-xl',
    },
  },
})
