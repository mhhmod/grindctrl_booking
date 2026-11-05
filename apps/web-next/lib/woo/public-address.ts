import { BlockList, isIP } from 'node:net';

// Shared by the plugin transport and garment transport. Normalize mapped
// IPv6 before classifying it: DNS may return dotted or hexadecimal forms.
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['2001::', 32], ['2001:2::', 48], ['2001:db8::', 32],
  ['2002::', 16], ['3fff::', 20],
] as const) blocked.addSubnet(net, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

/** Fail closed for non-public and transition addresses, including private
 * IPv4 addresses wrapped in any equivalent IPv6 spelling. */
export function isNonPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 6) {
    const normalized = new URL(`http://[${address}]`).hostname;
    const mapped = /^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/.exec(normalized);
    if (mapped) {
      const high = parseInt(mapped[1], 16);
      const low = parseInt(mapped[2], 16);
      return isNonPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    if (!globalV6.check(address, 'ipv6')) return true;
  }
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
