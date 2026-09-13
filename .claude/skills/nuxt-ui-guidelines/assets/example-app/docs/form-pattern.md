# Optional protected record editor

This documents the example application's EntityForm implementation. Use it when a workflow benefits from a protected working copy and explicit Save/Cancel. Its lifecycle and routing choices are not requirements for every form. A plain UForm or an existing host composition is appropriate for simpler edits, settings, or autosaved work; assess potential loss of meaningful input regardless of the form's category.

The example disables Save for unchanged edits and can disable known-invalid submission through its optional `valid` prop. A host may instead allow attempted submission to reveal validation errors.

### Optional Delete in the edit footer

- In edit mode, an optional icon-only Delete confirmation sits at the far left of that same footer row, with Cancel/Save grouped at the right.
- Show it only when **both** `showDelete=true` and a callable `deleteAction` are supplied; never show it for creation or duplication.
- Use ConfirmButton's native popover and a UTooltip, an accessible name, a record-specific confirmation title, and a concise consequence.
- Opening/cancelling confirmation must not submit or clear the draft.
- Block conflicting saves/cancellation during deletion; on failure keep the confirmation and input available for retry.
- Delete is independent of whether edited fields are valid or dirty.
- This shortcut suits a deletion whose consequence fits in a sentence; a cascade or a count that has to be shown moves to the modal container.

### Modal and page completion

- Modal forms use the `open` model and close only after successful save/delete or accepted cancellation.
- Page forms do not require `open`: successful save resets the dirty baseline and keeps the form mounted, while `saved`, `cancelled`, and `deleted` events let the host choose navigation, reset, or an empty state.
- Use async save/delete callbacks for persistence only; navigate from completion events so the form can finish its pending/dirty lifecycle first.
- This protected editor includes validation, error recovery, and dirty navigation protection.
- After a deleted form unmounts, the host must provide a logical focus destination.

```vue
<EntityForm presentation="page" title="Edit workshop" mode="edit"
  :state="draft" :schema="schema" :save="saveWorkshop"
  show-delete :delete-action="deleteWorkshop"
  :delete-title="`Delete ${record.name}?`"
  @cancelled="returnToList" @deleted="returnToList">
  <UFormField label="Name" name="name" required>
    <UInput v-model="draft.name" />
  </UFormField>
</EntityForm>
```

### Example routing

The example uses `?new=1`, `?edit=id`, and `?duplicate=id` to address editors. Back closes editors opened through navigation; direct URLs open them. Closing a directly loaded editor removes its query rather than blindly navigating away. Preserve unrelated query values and entered values when navigation is rejected.

This component uses Keep editing / Discard changes for dirty cancellation. Choose it when losing these edits warrants a prompt. Hosts may use dedicated routes, local modal state, or another existing editor pattern when those better fit the task.
