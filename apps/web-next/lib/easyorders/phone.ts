/** Egyptian national number, without country/trunk prefix. Reject other
 * countries and malformed inputs instead of matching arbitrary suffixes. */
export function normalizeEgyptPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const phone = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) {
    if (!digits.startsWith('20')) return null;
    digits = digits.slice(2);
  } else if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('00')) return null;
  else if (digits.length === 12 && digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[1-9]\d{9}$/.test(digits) ? digits.slice(-10) : null;
}
export function egyptPhoneMatches(a: unknown, b: unknown): boolean {
  const normalized = normalizeEgyptPhone(a);
  return normalized !== null && normalized === normalizeEgyptPhone(b);
}
