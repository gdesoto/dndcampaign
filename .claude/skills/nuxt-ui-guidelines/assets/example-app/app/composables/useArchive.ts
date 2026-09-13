/** Domain state remains in the caller; native toasts provide the Undo control. */
export function useArchive() {
  const toast = useToast();
  return <T extends { id: string; status: string }>(items: T[], collection: Ref<T[]>, label: string) => {
    const previous = new Map(items.map(item => [item.id, item.status]));
    items.forEach(item => { item.status = 'Archived'; });
    // Dismiss only this notification's own Undo; never clear the toaster, which
    // would evict another record's Undo or an unread error.
    const archived = toast.add({ title: `Archived ${label}`, color: 'success', duration: 5000,
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => {
        collection.value.forEach(item => {
          const status = previous.get(item.id);
          if (status !== undefined && item.status === 'Archived') item.status = status;
        });
        toast.remove(archived.id);
        toast.add({ title: `Restored ${label}`, color: 'success' });
      } }]
    });
  };
}
