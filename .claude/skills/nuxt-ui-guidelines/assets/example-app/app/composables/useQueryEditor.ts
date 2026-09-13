/** Native router queries make modal state shareable and Back/Forward aware. */
export function useQueryEditor<T extends { id: string }>(records: Ref<T[]>, prefix = '') {
  const route = useRoute();
  const router = useRouter();
  let pushed = false;
  const keys = { create: prefix ? `${prefix}New` : 'new', edit: prefix ? `${prefix}Edit` : 'edit', duplicate: prefix ? `${prefix}Duplicate` : 'duplicate' };
  const editing = computed(() => records.value.find(item => item.id === (route.query[keys.edit] || route.query[keys.duplicate])));
  const duplicate = computed(() => !!route.query[keys.duplicate]);
  const open = computed({
    get: () => !!route.query[keys.create] || !!editing.value,
    set: (value: boolean) => {
      if (value) return;
      if (pushed) { pushed = false; router.back(); }
      else {
        const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => !Object.values(keys).includes(key)));
        void router.replace({ query });
      }
    }
  });
  function form(item?: T, copy = false) {
    const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => !Object.values(keys).includes(key)));
    if (item) query[copy ? keys.duplicate : keys.edit] = item.id;
    else query[keys.create] = '1';
    pushed = true;
    void router.push({ query });
  }
  return { open, editing, duplicate, form };
}
