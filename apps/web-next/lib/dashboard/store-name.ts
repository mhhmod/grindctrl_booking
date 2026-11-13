/* How a store is named wherever the dashboard lists it. A Store Chat site
   is created as "My store" until its address is known (provisioning.ts), and
   pasted code never writes widget_sites.domain, so a store whose address we
   do know could still read "My store" in the switcher. The rule: the name
   the merchant gave it; else its address without the scheme, "www." or
   ".myshopify.com"; else the placeholder. Pure, safe for client code. */

/** The name provisioning gives a site whose address is not known yet. */
export const PLACEHOLDER_STORE_NAME = 'My store';

export function isPlaceholderStoreName(name: string | null | undefined): boolean {
  const value = name?.trim() ?? '';
  return value === '' || value.toLowerCase() === PLACEHOLDER_STORE_NAME.toLowerCase();
}

/** The host of a store address as typed or stored: no scheme, path, port or
 *  trailing dot, lower case. Null when nothing host-like is left. */
export function storeHost(address: string | null | undefined): string | null {
  const host = (address ?? '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '').replace(/\.$/, '');
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) ? host : null;
}

/** A store's name taken from its address: "harmong-eg.myshopify.com" reads
 *  "harmong-eg", "www.maison.example" reads "maison.example". */
export function storeNameFromAddress(address: string | null | undefined): string | null {
  const host = storeHost(address);
  if (!host) return null;
  return host.replace(/^www\./, '').replace(/\.myshopify\.com$/, '') || null;
}

/** The label a store is listed under. */
export function storeDisplayName(name: string | null | undefined, address: string | null | undefined): string | null {
  if (!isPlaceholderStoreName(name)) return name!.trim();
  return storeNameFromAddress(address);
}
