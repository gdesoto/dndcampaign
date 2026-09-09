import { defineComponent } from 'vue'
import SharedConfirmActionPopover from '../../app/components/shared/ConfirmActionPopover.vue'

// Keep panel integration tests focused on handlers; the shared menu has native interaction tests.
export const actionMenuStub = defineComponent({
  components: { SharedConfirmActionPopover },
  props: ['items'],
  template: `<div><template v-for="item in items" :key="item.label">
    <SharedConfirmActionPopover v-if="item.confirmation" :action="item.action" :confirm-label="item.confirmation.label || item.label" :message="item.confirmation.message" />
    <a v-else-if="item.to" :href="item.to">{{ item.label }}</a>
    <button v-else-if="item.action" @click="item.action()">{{ item.label }}</button>
  </template></div>`,
})
