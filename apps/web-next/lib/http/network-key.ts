/** The rate-limit identity of a client address (from clientIp in
 *  lib/ratelimit.ts). One IPv6 subscriber usually holds a whole /64 and can
 *  rotate through it freely, so IPv6 is keyed by its /64 prefix; IPv4,
 *  including IPv4-mapped IPv6, by the address. Text that does not parse keys
 *  as itself, and no address at all shares one bucket, never a client-chosen
 *  one. */
export function networkKey(ip: string | null | undefined): string {
  const raw = (ip ?? '').trim().replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (!raw) return 'unknown';
  if (!raw.includes(':')) return raw;
  const mapped = raw.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const halves = raw.split('::');
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2
    ? [...head, ...Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail]
    : head;
  if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return raw;
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
}
