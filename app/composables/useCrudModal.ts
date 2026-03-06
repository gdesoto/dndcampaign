type CrudModalMode = 'create' | 'edit'

export const useCrudModal = <TForm extends Record<string, unknown>>(
  createInitialForm: () => TForm
) => {
  const mode = ref<CrudModalMode>('create')
  const isOpen = ref(false)
  const error = ref('')
  const isSaving = ref(false)
  const form = reactive(createInitialForm()) as TForm

  const resetForm = (next?: Partial<TForm>) => {
    Object.assign(form, createInitialForm(), next || {})
  }

  const openCreate = (next?: Partial<TForm>) => {
    mode.value = 'create'
    error.value = ''
    resetForm(next)
    isOpen.value = true
  }

  const openEdit = (next: Partial<TForm>) => {
    mode.value = 'edit'
    error.value = ''
    resetForm(next)
    isOpen.value = true
  }

  const saveWith = async (
    handler: (context: { mode: CrudModalMode; form: TForm }) => Promise<void>,
    fallbackMessage: string
  ) => {
    error.value = ''
    isSaving.value = true
    try {
      await handler({ mode: mode.value, form })
      isOpen.value = false
    } catch (saveError) {
      error.value = (saveError as Error & { message?: string }).message || fallbackMessage
    } finally {
      isSaving.value = false
    }
  }

  return {
    mode,
    isOpen,
    form,
    error,
    isSaving,
    openCreate,
    openEdit,
    saveWith,
  }
}
