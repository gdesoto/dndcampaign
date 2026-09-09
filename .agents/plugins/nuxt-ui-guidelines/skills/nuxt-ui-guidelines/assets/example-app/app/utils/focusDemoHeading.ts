/** The example app owns its page-heading focus convention. */
export function focusDemoHeading() {
  // The last marker is the innermost heading: a page-local one when present,
  // otherwise the shared PageHeader title.
  const headings = document.querySelectorAll<HTMLElement>('[data-focus-fallback]');
  headings[headings.length - 1]?.focus();
}
