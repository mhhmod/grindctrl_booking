/* Opens a dashboard address as a page load rather than a client-side
   navigation, so a store chosen in the address is remembered
   (lib/dashboard/forward-request.ts remembers only page loads). Its own
   module so tests can watch it; jsdom cannot replace window.location. */
export function loadPage(href: string): void {
  window.location.assign(href);
}
