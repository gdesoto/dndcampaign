/** Only a plain activation outside controls may use the optional row shortcut. */
export function canNavigateRow(event: Event, selectedText = '') {
  if (selectedText || ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].some(key => key in event && Boolean(Reflect.get(event, key)))) return false;
  if ('button' in event && event.button !== 0) return false;
  const target = event.target as Element | null;
  return !target?.closest('a, button, input, select, textarea, [role="checkbox"], [role="combobox"], [contenteditable="true"], [data-row-no-navigate]');
}
