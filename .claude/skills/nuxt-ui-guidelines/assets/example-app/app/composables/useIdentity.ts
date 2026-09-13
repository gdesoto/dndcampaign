import { identities } from "../data/identities";
import type { Identity } from "../data/identities";

const STORAGE_KEY = "fieldwork-identity";

/**
 * Shared identity selection. State only: app.vue owns the side effects so the
 * runtime color aliases, the `<html>` token class, and the UTheme layer are
 * applied once for the whole application rather than once per reader.
 */
export function useIdentity() {
  // Restored during setup, not on mount: the watcher in app.vue persists the
  // active identity immediately, so a later restore would read a value it had
  // already overwritten.
  const active = useState<string>("identity", () => {
    const saved = import.meta.client ? localStorage.getItem(STORAGE_KEY) : null;
    return saved && identities.some((item) => item.id === saved)
      ? saved
      : identities[0]!.id;
  });
  const identity = computed<Identity>(
    () => identities.find((item) => item.id === active.value) ?? identities[0]!,
  );
  function select(id: string) {
    if (identities.some((item) => item.id === id)) active.value = id;
  }
  return { identities, identity, active, select, STORAGE_KEY };
}
