import type { MaybeRefOrGetter } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import DiscardChangesModal from '~/components/shared/DiscardChangesModal.vue'

/** Protect both in-app navigation and browser close/reload, without replacing routing. */
export const useUnsavedChanges = (
  dirty: MaybeRefOrGetter<boolean>,
  busy: MaybeRefOrGetter<boolean> = false,
  options: { isWithinScope?: (to: RouteLocationNormalized) => boolean } = {},
) => {
  const router = useRouter()
  const overlay = useOverlay()
  const modal = overlay.create(DiscardChangesModal)
  let confirmation: Promise<boolean> | undefined
  const confirmDiscard = async () => {
    if (toValue(busy)) return false
    if (!toValue(dirty)) return true
    if (!confirmation) {
      confirmation = modal.open().result.then(Boolean).finally(() => { confirmation = undefined })
    }
    return confirmation
  }
  const preventUnload = (event: BeforeUnloadEvent) => {
    if (!toValue(dirty) && !toValue(busy)) return
    event.preventDefault()
    event.returnValue = ''
  }
  const removeGuard = router.beforeEach((to, from) =>
    to.fullPath === from.fullPath || options.isWithinScope?.(to) || confirmDiscard())
  onMounted(() => window.addEventListener('beforeunload', preventUnload))
  onBeforeUnmount(() => {
    removeGuard()
    window.removeEventListener('beforeunload', preventUnload)
    modal.close(false)
  })
  return { confirmDiscard }
}
